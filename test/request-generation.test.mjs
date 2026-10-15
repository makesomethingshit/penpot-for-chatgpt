import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import test from 'node:test';

const mock = `
const encode = text => new TextEncoder().encode(text);
let oldStream;
let activeGet;
let posts = 0;
let resumes = 0;
const json = (m, result) => new Response(JSON.stringify({jsonrpc:'2.0',id:m.id,result}), {headers:{'content-type':'application/json'}});
const event = m => 'data: ' + JSON.stringify(m) + '\\n\\n';
globalThis.fetch = async (_, init) => {
 if(init.method === 'GET') {
  const token = new Headers(init.headers).get('last-event-id');
  if(token) {
   resumes++;
   process.stderr.write('resumed\\n');
   return new Response(new ReadableStream({start(c){
    activeGet=c;
    init.signal.addEventListener('abort',()=>{ process.stderr.write('get-aborted\\n'); c.error(new Error('cancel')); },{once:true});
   }}),{headers:{'content-type':'text/event-stream'}});
  }
  return new Response(new ReadableStream({start(c){
   init.signal.addEventListener('abort',()=>c.error(new Error('shutdown')),{once:true});
   setTimeout(()=>{if(!init.signal.aborted)c.enqueue(encode(event({jsonrpc:'2.0',method:'notifications/message',params:{level:'info',data:'unrelated-get'}})));},100);
  }}),{headers:{'content-type':'text/event-stream'}});
 }
 const m=JSON.parse(init.body);
 if(m.method.startsWith('notifications/')) return new Response(null,{status:202});
 if(m.method==='initialize') return json(m,{protocolVersion:'2025-03-26',capabilities:{},serverInfo:{name:'generation',version:'1'}});
 if(m.method==='') return new Response(JSON.stringify({jsonrpc:'2.0',id:m.id,error:{code:-32601,message:'Method not found'}}),{headers:{'content-type':'application/json'}});
 const mode=m.params?.mode;
 if(mode==='reject') throw new Error('synthetic request rejection');
 if(mode==='old') return new Response(new ReadableStream({start(c){oldStream=c;c.enqueue(encode(event({jsonrpc:'2.0',id:m.id,result:{value:'old'}})));}}),{headers:{'content-type':'text/event-stream'}});
 if(mode==='new') {
  if(process.env.CASE==='error') oldStream.error(new Error('old stream failed')); else oldStream.close();
  await new Promise(r=>setTimeout(r,60));
  return json(m,{value:'new'});
 }
 if(mode==='cancel') {
  posts++;
  return new Response(new ReadableStream({start(c){
   c.enqueue(encode('retry: 10\\nid: owned-event\\n'+event({jsonrpc:'2.0',method:'notifications/message',params:{level:'info',data:'primed'}})));
   init.signal.addEventListener('abort',()=>{process.stderr.write('post-aborted\\n');c.error(new Error('cancel'));},{once:true});
   if(process.env.CASE==='resumed') setTimeout(()=>c.close(),20);
  }}),{headers:{'content-type':'text/event-stream'}});
 }
 return json(m,{posts,resumes,value:'healthy'});
};`;

function runtime(t, mode) {
 const child=spawn(process.execPath,['--import','data:text/javascript,'+encodeURIComponent(mock),process.env.PENPOT_TEST_BRIDGE || 'plugin/server/bridge.mjs'],{
  env:{...process.env,PENPOT_MCP_URL:'https://design.penpot.app/mcp/stream?userToken=synthetic-generation',CASE:mode},stdio:['pipe','pipe','pipe'],windowsHide:true
 });
 t.after(()=>child.kill());
 const messages=[]; let stderr='';
 createInterface({input:child.stdout}).on('line',s=>messages.push(JSON.parse(s)));
 child.stderr.on('data',s=>{stderr+=s;});
 const wait=async predicate=>{
  const until=Date.now()+10000;
  while(!predicate()) {if(Date.now()>until) throw new Error('Bridge wait expired: '+stderr); await new Promise(r=>setTimeout(r,5));}
 };
 const send=(id,method,params)=>child.stdin.write(JSON.stringify({jsonrpc:'2.0',...(id===undefined?{}:{id}),method,params})+'\n');
 return {messages,stderr:()=>stderr,send,wait,async ready(){send(1,'initialize',{});await wait(()=>messages.some(m=>m.id===1));send(undefined,'notifications/initialized');},async close(){const done=once(child,'exit');child.stdin.end();assert.equal((await done)[0],0);}};
}
for(const ending of ['eof','error']) test('old SSE '+ending+' cannot retire a reused request ID',{timeout:15000},async t=>{
 const f=runtime(t,ending);await f.ready();f.send(2,'tools/call',{mode:'old'});await f.wait(()=>f.messages.some(m=>m.id===2));
 f.send(2,'tools/call',{mode:'new'});await f.wait(()=>f.messages.filter(m=>m.id===2).length>=2);
 await new Promise(r=>setTimeout(r,120));
 assert.deepEqual(f.messages.filter(m=>m.id===2),[{jsonrpc:'2.0',id:2,result:{value:'old'}},{jsonrpc:'2.0',id:2,result:{value:'new'}}]);
 await f.close();
});
test('empty string method forwards exactly one terminal error',{timeout:15000},async t=>{
 const f=runtime(t,'empty');await f.ready();f.send(3,'',{});await f.wait(()=>f.messages.some(m=>m.id===3));
 await new Promise(r=>setTimeout(r,50));assert.deepEqual(f.messages.filter(m=>m.id===3),[{jsonrpc:'2.0',id:3,error:{code:-32601,message:'Method not found'}}]);await f.close();
});

test('failed requests preserve zero and string IDs and allow reuse', { timeout: 15000 }, async t => {
 const f = runtime(t, 'reject');
 await f.ready();
 for (const id of [0, '', 'request-a']) {
  f.send(id, 'tools/call', { mode: 'reject' });
  await f.wait(() => f.messages.some(message => message.id === id));
  assert.deepEqual(f.messages.find(message => message.id === id), {
   jsonrpc: '2.0', id, error: {
    code: -32000,
    message: 'Penpot connection failed. Remote outcome unknown; inspect the intended file before retrying.'
   }
  });
  f.send(id, 'tools/call', { mode: 'healthy' });
  await f.wait(() => f.messages.filter(message => message.id === id).length >= 2);
  assert.equal(f.messages.filter(message => message.id === id)[1].result.value, 'healthy');
 }
 await new Promise(resolve => setTimeout(resolve, 50));
 for (const id of [0, '', 'request-a']) assert.equal(f.messages.filter(message => message.id === id).length, 2);
 assert.ok(!f.stderr().includes('synthetic request rejection'));
 await f.close();
});

for(const mode of ['post','resumed']) test('cancelled resumable '+mode+' stops owned reconnects and preserves unrelated GET',{timeout:15000},async t=>{
 const f=runtime(t,mode);await f.ready();f.send(5,'tools/call',{mode:'cancel'});
 await f.wait(()=>f.messages.some(m=>m.params?.data==='primed'));
 if(mode==='resumed') await f.wait(()=>f.stderr().includes('resumed'));
 f.send(undefined,'notifications/cancelled',{requestId:5});
 await f.wait(()=>f.stderr().includes(mode==='post'?'post-aborted':'get-aborted'));
 await new Promise(r=>setTimeout(r,120));f.send(6,'tools/call',{mode:'healthy'});
 await f.wait(()=>f.messages.some(m=>m.id===6));
 assert.deepEqual(f.messages.find(m=>m.id===6).result,{posts:1,resumes:mode==='post'?0:1,value:'healthy'});
 assert.equal(f.messages.some(m=>m.id===5),false);
 await f.wait(()=>f.messages.some(m=>m.params?.data==='unrelated-get'));
 await f.close();
});
