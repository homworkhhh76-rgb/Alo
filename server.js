const http=require("http");
const fs=require("fs");
const path=require("path");

const PORT=8080;
const rooms=new Map();

function four(){return String(Math.floor(1000+Math.random()*9000));}
function json(res,obj,status=200){
  const body=JSON.stringify(obj);
  res.writeHead(status,{
    "Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"no-store"
  });
  res.end(body);
}

const server=http.createServer((req,res)=>{
  const u=new URL(req.url,`http://${req.headers.host}`);

  if(req.method==="GET" && (u.pathname==="/" || u.pathname==="/index.html")){
    const file=path.join(__dirname,"index.html");
    fs.readFile(file,(err,data)=>{
      if(err){res.writeHead(500);return res.end("index.html not found");}
      res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});
      res.end(data);
    });
    return;
  }

  if(req.method==="GET" && u.pathname==="/health"){
    return json(res,{ok:true});
  }

  if(req.method==="POST"){
    let body="";
    req.on("data",d=>body+=d);
    req.on("end",()=>{
      let x={};
      try{x=JSON.parse(body||"{}")}catch{return json(res,{error:"JSON غير صالح"},400)}

      if(u.pathname==="/api/create"){
        let q;
        do{q=four()}while(rooms.has(q));
        rooms.set(q,{answer:four(),messages:[],sse:new Set(),created:Date.now()});
        setTimeout(()=>rooms.delete(q),30*60*1000);
        return json(res,{question:q});
      }

      if(u.pathname==="/api/join"){
        const q=String(x.question||"").replace(/\D/g,"").slice(0,4);
        const room=rooms.get(q);
        if(!room)return json(res,{error:"السؤال غير موجود أو انتهت صلاحيته"},404);
        return json(res,{answer:room.answer});
      }

      if(u.pathname==="/api/check"){
        const q=String(x.question||"").replace(/\D/g,"").slice(0,4);
        const a=String(x.answer||"").replace(/\D/g,"").slice(0,4);
        const room=rooms.get(q);
        return json(res,{ok:!!room && room.answer===a});
      }

      if(u.pathname==="/api/msg"){
        const q=String(x.question||"").replace(/\D/g,"").slice(0,4);
        const room=rooms.get(q);
        if(!room)return json(res,{error:"انتهت جلسة الخط"},404);
        const msg={text:String(x.text||"").slice(0,4000),role:x.role==="b"?"b":"a",at:Date.now()};
        room.messages.push(msg);
        if(room.messages.length>200)room.messages.shift();
        for(const s of room.sse){
          try{s.write(`event: msg\ndata: ${JSON.stringify(msg)}\n\n`)}catch{}
        }
        return json(res,{ok:true});
      }

      return json(res,{error:"Not found"},404);
    });
    return;
  }

  if(req.method==="GET" && u.pathname==="/events"){
    const q=String(u.searchParams.get("room")||"").replace(/\D/g,"").slice(0,4);
    const room=rooms.get(q);
    if(!room){res.writeHead(404);return res.end();}

    res.writeHead(200,{
      "Content-Type":"text/event-stream; charset=utf-8",
      "Cache-Control":"no-cache, no-transform",
      "Connection":"keep-alive"
    });

    room.sse.add(res);
    res.write("event: ready\ndata: {}\n\n");

    const ping=setInterval(()=>{
      try{res.write(": ping\n\n")}catch{}
    },15000);

    req.on("close",()=>{
      clearInterval(ping);
      room.sse.delete(res);
    });
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT,"0.0.0.0",()=>{
 console.log("");
 console.log("خطّي LAN جاهز");
 console.log("على الجهاز المضيف: http://localhost:"+PORT);
 console.log("من الهاتف الثاني: http://IP-الجهاز-المضيف:"+PORT);
 console.log("لا يحتاج إنترنت للمراسلة.");
 console.log("");
});
