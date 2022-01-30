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
let roomName;
let myPeerConnection;
let myDataChannel;

async function getCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices(); // 유저와 연결된 모든 디바이스 정보 불러오기
    const cameras = devices.filter((device) => device.kind === "videoinput"); //비디오 인풋만 골라내기
    const currentCamera = myStream.getVideoTracks()[0]; // 현재 선택된 카메라 찾기
    cameras.forEach((camera) => {
      const option = document.createElement("option");
      option.value = camera.deviceId;
      option.innerText = camera.label;
      if (currentCamera.label === camera.label) {
        option.selected = true; // 선택된 카메라 selected 표시
      }
      camerasSelect.append(option);
    });
  } catch (e) {
    console.log(e);
  }
}

async function getMedia(deviceId) {
  const initialConstraints = {
    audio: true,
    video: { facingMode: "user" }, // 초기 설정값(앱시작 시): 셀카방향(모바일), pc는 하나임
  };
  const cameraConstraints = {
    audio: true,
    video: { deviceId: { exact: deviceId } }, // 디바이스 선택 시 설정값
  };
  try {
    myStream = await navigator.mediaDevices.getUserMedia(
      deviceId ? cameraConstraints : initialConstraints
    );
    myFace.srcObject = myStream; // User 미디어 가져오기
    if (!deviceId) {
      await getCameras();
    }
  } catch (e) {
    console.log(e);
  }
}

getMedia();

function handleMuteClick() {
  myStream
    .getAudioTracks()
    .forEach((track) => (track.enabled = !track.enabled)); // Audio 활성화 변경
  if (!muted) {
    muteBtn.innerText = "Unmute";
    muted = true;
  } else {
    muteBtn.innerText = "Mute";
    muted = false;
  }
}
function handleCameraClick() {
  myStream
    .getVideoTracks()
    .forEach((track) => (track.enabled = !track.enabled)); // Camera 활성화 변경
  if (cameraOff) {
    cameraBtn.innerText = "Turn Camera Off";
    cameraOff = false;
  } else {
    cameraBtn.innerText = "Turn Camera On";
    cameraOff = true;
  }
}

async function handleCameraChange() {
  await getMedia(camerasSelect.value); // 미디어 다시 부르기
  if (myPeerConnection) {
    const videoTrack = myStream.getVideoTracks()[0]; // 바뀐 트랙 불러오기
    const videoSender = myPeerConnection
      .getSenders() // 스트림에 보낸 트랙을 컨트롤할 수 있는 함수
      .find((sender) => sender.track.kind === "video");
    videoSender.replaceTack(videoTrack); // 비디오인 트랙을 찾아 바뀐 트랙으로 대체
  }
}

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input", handleCameraChange);

// Welcome Form (join room)

const welcome = document.getElementById("welcome");
const welcomeForm = welcome.querySelector("form");

async function initCall() {
  // 방에 입장할 때 미디어 부르기, Peer간 connection 만들기
  welcome.hidden = true;
  call.hidden = false;
  await getMedia(); // Connection 만들기 전에 미디어 불러오기
  makeConnection();
}

async function handleWelcomeSubmit(event) {
  event.preventDefault();
  const input = welcomeForm.querySelector("input");
  await initCall(); // 룸에 들어가기 전에 Connection 생성 : 속도가 너무 빨라 비동기방식으로 설정
  socket.emit("join_room", input.value);
  roomName = input.value;
  input.value = "";
}

welcomeForm.addEventListener("submit", handleWelcomeSubmit);

// Socket Code

socket.on("welcome", async () => {
  // Peer A에서 실행되는 코드: 상대방이 들어와야 실행됨
  myDataChannel = myPeerConnection.createDataChannel("chat"); // peerconnection에 데이터 채널 만들기
  myDataChannel.addEventListener("message", (event) => console.log(event.data));
  console.log("made data channel");
  const offer = await myPeerConnection.createOffer();
  myPeerConnection.setLocalDescription(offer);
  console.log("sent the offer");
  socket.emit("offer", offer, roomName);
});

socket.on("offer", async (offer) => {
  // Peer B에서 실행되는 코드
  myPeerConnection.addEventListener("datachannel", (event) => {
    myDataChannel = event.channel; // datachannel 추가하기
    myDataChannel.addEventListener("message", (event) =>
      console.log(event.data)
    );
  });
  console.log("received the offer");
  myPeerConnection.setRemoteDescription(offer); // 받은 offer로 Remote Description 설정
  const answer = await myPeerConnection.createAnswer(); // answer 생성
  myPeerConnection.setLocalDescription(answer); // 생성한 answer로 Local Description 설정
  socket.emit("answer", answer, roomName); // answer 보내기
  console.log("sent the answer");
});

socket.on("answer", (answer) => {
  console.log("received the answer");
  myPeerConnection.setRemoteDescription(answer); // Peer A: 서버로부터 asnwer 받고 Remote Description 설정
});

socket.on("ice", (ice) => {
  console.log("received candidate");
  myPeerConnection.addIceCandidate(ice); // icecandidate를 받아 추가하기
});

// RTC Code

function makeConnection() {
  myPeerConnection = new RTCPeerConnection({
    iceServers: [
      // Stun : 접속하면 공용 IP 주소를 알려주는 서버, 테스트용
      {
        urls: [
          "stun:stun.l.google.com:19302",
          "stun:stun1.l.google.com:19302",
          "stun:stun2.l.google.com:19302",
          "stun:stun3.l.google.com:19302",
          "stun:stun4.l.google.com:19302",
        ],
      },
    ],
  }); // RTCPeer Connection 만들기
  myPeerConnection.addEventListener("icecandidate", handleIce); // icecandidate 생성: icecandidate는 peer가 갖고 있는 소통 방법, peer간에 주고 받아야 함
  myPeerConnection.addEventListener("addstream", handleAddStream); // stream 생성
  myStream
    .getTracks()
    .forEach((track) => myPeerConnection.addTrack(track, myStream)); // peerConnection에 트랙, 스트림 정보 추가하기
}

function handleIce(data) {
  console.log("sent candidate");
  socket.emit("ice", data.candidate, roomName); // 서버로 icecandidate 보내기
}

function handleAddStream(data) {
  const peerFace = document.getElementById("peerFace");
  peerFace.srcObject = data.stream; // video 태그에 src로 데이타 스트림 추가
}
