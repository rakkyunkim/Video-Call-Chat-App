
const socket = io();

const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");
const call = document.getElementById("call");

call.hidden = true;

let myStream;
let muted = false;
let cameraOff = false;
let videoRoomName;
let myPeerConnection;

async function getCameras(){
    try{
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind === "videoinput");
        const currentCamera = myStream.getVideoTracks()[0];
        cameras.forEach((camera) => {
            const option = document.createElement("option");
            option.value = camera.deviceId;
            option.innerText = camera.label;
            if(currentCamera.label === camera.label){
                option.selected = true;
            }
            camerasSelect.appendChild(option);
        })
    }catch(e){
        console.log(e);
    }
}

//video calling.
async function getMedia(deviceId){
    //w/o device id
    const initConstraints = {
        audio: true,
        video: {facingMode: "user"},
    };
    //with device id
    const cameraConstraints = {
        audio: true,
        video: {deviceId: {exact: deviceId}},
    };
    try {
        console.log(navigator.mediaDevices);
        myStream = await navigator.mediaDevices.getUserMedia(
            deviceId ? cameraConstraints : initConstraints
        );
        myFace.srcObject = myStream;
        if(!deviceId){
            await getCameras();
        }
    } catch(e){
        console.log(e);
    }
}

function handleMuteClick(){
    myStream.getAudioTracks().forEach(track => (
        track.enabled = !track.enabled
    ));
    if(!muted){
        muteBtn.innerText = "Unmuted";
        muted = true;
    } else{
        muteBtn.innerText = "Mute";
        muted = false;
    }
}
function handleCameraClick(){
    myStream.getVideoTracks().forEach(track => (
        track.enabled = !track.enabled
    ));
    if(cameraOff){
        cameraBtn.innerText = "Turn Camera Off";
        cameraOff = false;
    } else{
        cameraBtn.innerText = "Turn Camera On";
        cameraOff = true;
    }
}

async function handleCameraChange(){
    await getMedia(camerasSelect.value);
    if(myPeerConnection){
        const videoTrack = myStream.getVideoTracks()[0];
        const videoSender = myPeerConnection.getSenders().find(sender => sender.track.kind === "video");
        videoSender.replaceTrack(videoTrack);
    }
}


muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input", handleCameraChange);

// Welcom Form (choose a room for video calling)

const welcomeVideo = document.getElementById("welcomeVideo");
const welcomeForm = welcomeVideo.querySelector("form");

async function initCall(){
    welcomeVideo.hidden = true;
    call.hidden = false;
    await getMedia();
    makeConnection();
}

async function handleWelcomeSubmit(event){
    event.preventDefault();
    const input = welcomeForm.querySelector("input");
    await initCall();
    socket.emit("join_room", input.value);
    videoRoomName = input.value;
    input.value = "";
}
welcomeForm.addEventListener("submit", handleWelcomeSubmit);

//Socket Code
//Peer A => create, set local description, sends offer to Peer B
socket.on("videoWelcome", async () => {
    const offer = await myPeerConnection.createOffer();
    myPeerConnection.setLocalDescription(offer);
    console.log("sent the offer");
    socket.emit("offer", offer, videoRoomName);
});
//Peer B => get offer, set remote, local description
socket.on("offer", async (offer) => {
    console.log("received the offer");
    myPeerConnection.setRemoteDescription(offer);
    const answer = await myPeerConnection.createAnswer();
    myPeerConnection.setLocalDescription(answer);
    socket.emit("answer", answer, videoRoomName);
    console.log("sent the answer");
});
socket.on("answer", (answer) => {
    console.log("received the answer");
    myPeerConnection.setRemoteDescription(answer);
});
socket.on("ice", ice => {
    console.log("received candidate");
    myPeerConnection.addIceCandidate(ice);
});

//RTC Code
function makeConnection(){
    myPeerConnection = new RTCPeerConnection({
        iceServers: [
            {
                urls: [
                    "stun:stun.l.google.com:19302",
                    "stun:stun1.l.google.com:19302",
                    "stun:stun2.l.google.com:19302",                                                                                                                              
                    "stun:stun3.l.google.com:19302",
                    "stun:stun4.l.google.com:19302",
                ],
            }
        ],
    });
    myPeerConnection.addEventListener("icecandidate", handleIce);
    myPeerConnection.addEventListener("addstream", handleAddStream);
    myStream.getTracks().forEach(track => myPeerConnection.addTrack(track, myStream));

}
function handleIce(data){
    console.log("sent candidate");
    socket.emit("ice", data.candidate, roomName);
}
function handleAddStream(date){
    const peersFace = document.getElementById("peersFace");
    peersFace.srcObject = data.stream;
}

//CHAT FUNCRIONALITIES
const welcome = document.getElementById("welcome");
const form = welcome.querySelector("#welcome form");
const room = document.getElementById("room");


room.hidden = true;

let roomName;
let nickname;

function addMessage(msg){
    const ul = room.querySelector("ul");
    const li = document.createElement("li");

    li.innerText = msg;
    ul.appendChild(li);
}
function handleMessageSubmit(event){
    event.preventDefault();
    const input = room.querySelector("#message");
    const currNickName = room.querySelector("#name");
    socket.emit("new_message", input.value, roomName, () => {
        addMessage(`You: ${input.value}`);
        currNickName.value = nickname;
        input.value = "";
    });
}
function handleNickNameSubmit(event){
    event.preventDefault();
    const newNickName = room.querySelector("#name");
    socket.emit("new_name", nickname, newNickName.value, roomName, () => {
        addMessage(`Your Name Changed To: ${newNickName.value}`);
        nickname = newNickName.value;
    });
}
function showRoom(newCount){
    welcome.hidden = true;
    room.hidden = false;
    const h3 = room.querySelector("h3");
    h3.innerText = `Room: ${roomName} (#People: ${newCount})`;
    const msgForm = room.querySelector("#msg");
    const nicknameChangeForm = room.querySelector("#nickname");
    msgForm.addEventListener("submit", handleMessageSubmit);
    nicknameChangeForm.addEventListener("submit", handleNickNameSubmit);
}

function handleRoomSubmit(event){
    const roomNameInput = welcome.querySelector("#roomName");
    const nickNameInput = welcome.querySelector("#name");
    event.preventDefault();
    socket.emit("enter_room", roomNameInput.value, nickNameInput.value, showRoom);
    roomName = roomNameInput.value;
    roomNameInput.value = "";
    nickname = nickNameInput.value;
    const changeNameInput = room.querySelector("#name");
    changeNameInput.value = nickname;
}

form.addEventListener("submit", handleRoomSubmit);

socket.on("welcome", (user, newCount) => {
    const h3 = room.querySelector("h3");
    h3.innerText = `Room: ${roomName} (#People: ${newCount})`;
    addMessage(`${user} joined!`);
});
socket.on("bye", (left, newCount) => {
    const h3 = room.querySelector("h3");
    h3.innerText = `Room: ${roomName} (#People: ${newCount})`;
    addMessage( `${left} left :(`);
});
socket.on("new_message", addMessage);
socket.on("new_name", addMessage);
socket.on("room_change", (rooms) => {
    const roomList = welcome.querySelector("ul");
    roomList.innerHTML = "";
    if(rooms.length === 0){
        return;
    }
    rooms.forEach(room => {
        const li = document.createElement("li");
        li.innerText = room;
        roomList.append(li);
    });
});

















// Using webSocket without socket.io
// //FRONTEND
// //connects frontend to backend ws server.
// const messageList = document.querySelector("ul");
// const nickForm = document.querySelector("#nick");
// const messageForm = document.querySelector("#message");
// const currentNick = document.querySelector("#nick span");

// function makeMessage(type, payload){
//     const msg = {type, payload};
//     return JSON.stringify(msg);
// }

// const socket = new WebSocket(`ws://${window.location.host}`);

// socket.addEventListener("open", () => {
//     console.log("Connected to server ✔️");
// });

// socket.addEventListener("message", (message) => {
//     console.log("New message: ", message.data);
//     const li = document.createElement("li");
//     li.innerText = message.data;
//     messageList.append(li);
// });

// socket.addEventListener("close", () => {
//     console.log("Disconnected from the server ❌");
// });
// //backend = terminal
// //frontend = browser console
// function handleSubmit(event){
//     event.preventDefault();
//     const input = messageForm.querySelector("input");
//     socket.send(makeMessage("new_message", input.value));
//     const li = document.createElement("li");
//     li.innerText = `You: ${input.value}`;
//     messageList.append(li);
//     input.value = "";
// }
// function handleNickSubmit(event){
//     event.preventDefault();
//     const input = nickForm.querySelector("input");
//     socket.send(makeMessage("nickname", input.value));
//     currentNick.innerHTML = `Current Name: ${input.value}`;
//     input.value = "";
// }
// messageForm.addEventListener("submit", handleSubmit);

// nickForm.addEventListener("submit", handleNickSubmit);