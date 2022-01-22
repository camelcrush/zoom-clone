import http from "http";
import { Server } from "socket.io";
import express from "express";

const app = express();

app.set("view engine", "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));
app.get("/", (_, res) => res.render("home"));
app.get("/*", (req, res) => res.redirect("/"));

const handleListen = () => console.log(`Listening on http://localhost:3000`);

const httpServer = http.createServer(app);
const io = new Server(httpServer);

function publicRooms() {
  const {
    sockets: {
      adapter: { sids, rooms }, // sids와 rooms에는 소켓id가 포함되어 있음, private socket과 publick socket이 있음
    },
  } = io;
  const publicRooms = [];
  rooms.forEach((_, key) => {
    if (sids.get(key) === undefined) {
      // 만들어진 룸을 찾는 방법
      publicRooms.push(key);
    }
  });
  return publicRooms;
}

io.on("connection", (socket) => {
  socket["nickname"] = "Anonymous";
  socket.onAny((event) => {
    console.log(`Socket Event: ${event}`); // 이벤트리스너
  });
  socket.on("enter_room", (roomName, done) => {
    socket.join(roomName);
    done();
    socket.to(roomName).emit("welcome", socket.nickname); // 입장알림 클라이언트(룸)로 보내기, 닉네임 인자로 전달
    io.sockets.emit("room_change", publicRooms()); // 룸이 변경될 시 클라이언트에 알리기
  });
  socket.on("disconnecting", () => {
    socket.rooms.forEach((room) =>
      socket.to(room).emit("bye", socket.nickname)
    ); // 퇴장알림 클라이언트(룸)로 보내기, 닉네임 인자로 전달
  });
  socket.on("disconnect", () => {
    io.sockets.emit("room_change", publicRooms()); // 룸이 삭제될 때 클라이언트에 알리기
  });
  socket.on("new_message", (msg, room, done) => {
    socket.to(room).emit("new_message", `${socket.nickname}: ${msg}`);
    done();
  });
  socket.on("nickname", (nickname) => (socket["nickname"] = nickname)); //소켓에 닉내임 저장하기
});
// const wss = new Websocket.Server({ server });

// const sockets = [];

// wss.on("connection", (socket) => {
//   sockets.push(socket);
//   socket["nickname"] = "Anonymous";
//   console.log("Connected to Browser");
//   socket.on("close", () => console.log("Disconnected from the Browser"));
//   socket.on("message", (msg) => {
//     const message = JSON.parse(msg);
//     switch (message.type) {
//       case "new_message":
//         sockets.forEach((aSocket) =>
//           aSocket.send(`${socket.nickname}: ${message.payload}`)
//         );
//         break;
//       case "nickname":
//         socket["nickname"] = message.payload;
//         break;
//     }
//   });
// });

httpServer.listen(3000, handleListen);
