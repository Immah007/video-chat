const socket = io();
const config = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};

const videoContainer = document.getElementById('videoContainer');
const peers = {}; // Store peer connections

// Start video stream
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
        const localVideo = document.createElement('video');
        localVideo.srcObject = stream;
        localVideo.autoplay = true;
        localVideo.muted = true;
        localVideo.id = 'localVideo';
        videoContainer.appendChild(localVideo);

        // When a new user connects, create a peer connection
        socket.on('new-user', (userId) => {
            createPeerConnection(userId, stream);
        });

        // Handle offers from other users
        socket.on('offer', (data) => {
            handleOffer(data.sdp, data.sender, stream);
        });

        // Handle answers from other users
        socket.on('answer', (data) => {
            handleAnswer(data.sdp, data.sender);
        });

        // Handle ICE candidates from other users
        socket.on('ice-candidate', (data) => {
            handleIceCandidate(data.candidate, data.sender);
        });

        // Handle user disconnection
        socket.on('user-disconnected', (userId) => {
            if (peers[userId]) {
                peers[userId].close();
                delete peers[userId];
                document.getElementById(userId)?.remove();
            }
        });
    })
    .catch(error => console.error('Error accessing media devices:', error));

function createPeerConnection(userId, localStream) {
    const peerConnection = new RTCPeerConnection(config);
    peers[userId] = peerConnection;

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', { candidate: event.candidate, target: userId });
        }
    };

    peerConnection.ontrack = (event) => {
        let remoteVideo = document.getElementById(userId);
        if (!remoteVideo) {
            remoteVideo = document.createElement('video');
            remoteVideo.id = userId;
            remoteVideo.autoplay = true;
            videoContainer.appendChild(remoteVideo);
        }
        remoteVideo.srcObject = event.streams[0];
    };

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.createOffer()
        .then(offer => peerConnection.setLocalDescription(offer))
        .then(() => {
            socket.emit('offer', { sdp: peerConnection.localDescription, target: userId });
        });
}

function handleOffer(sdp, sender, localStream) {
    const peerConnection = new RTCPeerConnection(config);
    peers[sender] = peerConnection;

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', { candidate: event.candidate, target: sender });
        }
    };

    peerConnection.ontrack = (event) => {
        let remoteVideo = document.getElementById(sender);
        if (!remoteVideo) {
            remoteVideo = document.createElement('video');
            remoteVideo.id = sender;
            remoteVideo.autoplay = true;
            videoContainer.appendChild(remoteVideo);
        }
        remoteVideo.srcObject = event.streams[0];
    };

    peerConnection.addStream(localStream);

    peerConnection.setRemoteDescription(new RTCSessionDescription(sdp))
        .then(() => peerConnection.createAnswer())
        .then(answer => peerConnection.setLocalDescription(answer))
        .then(() => {
            socket.emit('answer', { sdp: peerConnection.localDescription, target: sender });
        });
}

function handleAnswer(sdp, sender) {
    peers[sender].setRemoteDescription(new RTCSessionDescription(sdp));
}

function handleIceCandidate(candidate, sender) {
    peers[sender].addIceCandidate(new RTCIceCandidate(candidate));
}
