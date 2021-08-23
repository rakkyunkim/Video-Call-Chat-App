//BACKEND
import express from "express";
import {Server} from "socket.io";
import http from "http";
import {instrument} from "@socket.io/admin-ui";
//import WebSocket from "ws";

const app = express();

app.set("view engine", "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));
app.get("/", (req, res) => res.render("home"));
app.get("/*", (req, res) => res.redirect("/"));

//starting http and websocket in the same server
const httpServer = http.createServer(app);
//GUI
const io = new Server(httpServer, {
    cors: {
      origin: ["https://admin.socket.io"],
      credentials: true
    }
  });
  instrument(io, {
    auth: false
  });
//making rooms using adapters
function publicRooms(){
    const {
        sockets: {
            adapter:{sids, rooms},
        },
    } = io;

    const publicRooms = [];
    rooms.forEach((_, key) => {
        if(sids.get(key) === undefined){
            publicRooms.push(key);
        }
    });
    return publicRooms;
}

function countRoom(roomName){
    return io.sockets.adapter.rooms.get(roomName)?.size;
}

io.on("connection", (socket) => {
    socket["nickname"] = "Anonymous";
    socket.onAny((event) => {
        console.log(io.adapter);
        console.log(`Socket Event: ${event}`);
    });
    socket.on("enter_room", (roomName, nickname, done) => {
        socket["nickname"] = nickname;
        socket.join(roomName);
        done(countRoom(roomName));
        socket.to(roomName).emit("welcome", socket.nickname, countRoom(roomName));
        io.sockets.emit("room_change", publicRooms());
    });
    socket.on("disconnecting", () => {
        socket.rooms.forEach((room) => socket.to(room).emit("bye", socket.nickname, countRoom(room) - 1));
    });
    socket.on("disconnect", () => {
        io.sockets.emit("room_change", publicRooms());
    });
    socket.on("new_message", (msg, room, done) => {
        socket.to(room).emit("new_message", `${socket.nickname}: ${msg}`);
        done();
    });
    socket.on("new_name", (oldName, name, room, change) => {
        socket.to(room).emit("new_name", `${oldName} changed name to ${name}`);
        socket["nickname"] = name;
        change();
    });
    socket.on("join_room", (roomName) => {
        socket.join(roomName);
        socket.to(roomName).emit("videoWelcome");
    });
    socket.on("offer", (offer, roomName) => {
        socket.to(roomName).emit("offer", offer);
    });
    socket.on("answer", (answer, roomName) => {
        socket.to(roomName).emit("answer", answer);
    });
    socket.on("ice", (ice, roomName) => {
        socket.to(roomName).emit("ice", ice);
    });
});

//WEB SOCKET 
// //put different browser's servers to make them able to receive messages from each others
// const sockets = [];
// const wss = new WebSocket.Server({server});
// wss.on("connection", (socket)=>{
//     sockets.push(socket);
//     socket["nickname"] = "Anonymous";
//     console.log("Connected to browser ✔️");
//     socket.on("close", () => {
//         console.log("Disconnected from the browser ❌");
//     });
//     socket.on("message", (msg)=>{
//         const message = JSON.parse(msg);
//         switch(message.type){
//             case "new_message":
//                 sockets.forEach(aSocket => aSocket.send(`${socket.nickname}: ${message.payload}`));
//                 break;
//             case "nickname":
//                 socket["nickname"] = message.payload;
//                 break;
//         }
//         console.log(message);
//     });
// });
const handleListen = () => console.log(`Listening on http://localhost:3000`);
httpServer.listen(3000, handleListen);
