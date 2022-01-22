const socket = io();

const welcome = document.getElementById("welcome");
const form = welcome.querySelector("form");
const room = document.getElementById("room");

room.hidden = true;

let roomName;

function addMessage(message) {
  // 송수신 메세지 클라이언트에 표시
  const ul = room.querySelector("ul");
  const li = document.createElement("li");
  li.innerText = message;
  ul.appendChild(li);
}

function handleMessageSubmit(event) {
  event.preventDefault();
  const input = room.querySelector("#msg input");
  const value = input.value;
  socket.emit("new_message", input.value, roomName, () => {
    addMessage(`You: ${value}`); // 보낸 메세지 클라이언트에 표시 //input.value로는 메세지가 안 나타남 string으로 넣기
  });
  input.value = "";
}

function handleNicknameSubmit(event) {
  event.preventDefault();
  const input = room.querySelector("#name input");
  socket.emit("nickname", input.value);
}

function showRoom() {
  welcome.hidden = true;
  room.hidden = false;
  const h3 = room.querySelector("h3");
  h3.innerText = `Room ${roomName}`;
  const msgForm = room.querySelector("#msg");
  const nameForm = room.querySelector("#name");
  msgForm.addEventListener("submit", handleMessageSubmit); //메세지 보내기
  nameForm.addEventListener("submit", handleNicknameSubmit); //닉네임 설정하기
}

function handleRoomSubmit(event) {
  event.preventDefault();
  const input = form.querySelector("input");
  socket.emit("enter_room", input.value, showRoom);
  roomName = input.value;
  input.value = "";
}

form.addEventListener("submit", handleRoomSubmit);

socket.on("welcome", (user, userCount) => {
  const h3 = room.querySelector("h3");
  h3.innerText = `Room ${roomName} (${userCount})`;
  addMessage(`${user} joined!`); // 입장 알림
});

socket.on("bye", (user, userCount) => {
  const h3 = room.querySelector("h3");
  h3.innerText = `Room ${roomName} (${userCount})`;
  addMessage(`${user} left!`); //퇴장 알림
});

socket.on("new_message", addMessage); //메세지 받기 // (msg) => {addMessage(msg)}와 같음

socket.on("room_change", (rooms) => {
  // 활성화된 룸 리스트 보여주기
  const roomList = welcome.querySelector("ul");
  roomList.innerHTML = "";
  if (rooms.length === 0) {
    return;
  }
  rooms.forEach((room) => {
    const li = document.createElement("li");
    li.innerText = room;
    roomList.append(li);
  });
});
