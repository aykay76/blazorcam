let video = null;
let otherVideo = null
let context = null;
let streaming = false;

let width = 100;    // We will scale the photo width to this.
let height = 0;     // This will be computed based on the input stream

var mediaConstraints = {
    audio: true, // We want an audio track
    video: true // ...and we want a video track
};

let rtcConnection = null
let myVideoStream = null

const srConnection = new signalR.HubConnectionBuilder()
    .withUrl("/webrtc")
    .configureLogging(signalR.LogLevel.Information)
    .build();

async function start() {
    try {
        await srConnection.start();
        console.log("SignalR Connected.");
    } catch (err) {
        console.log(err);
        setTimeout(start, 5000);
    }
};

// connect to SignalR
start();

srConnection.on("Receive", data => {
    var message = JSON.parse(data)
console.log(message)
    if (message.sdp) {
        if (message.sdp.type == 'offer') {
            createPeerConnection()
            rtcConnection.setRemoteDescription(new RTCSessionDescription(message.sdp))
            .then(function () {
                return navigator.mediaDevices.getDisplayMedia(mediaConstraints);
            })
            .then(function(stream) {
                myVideoStream = stream
                video = document.getElementById("video")
                video.srcObject = stream

                // Add our stream to the connection to be shared
                rtcConnection.addStream(myVideoStream);
            })
            .then(function() {
                return rtcConnection.createAnswer()
            })
            .then(function (answer) {
                return rtcConnection.setLocalDescription(answer);
            })
            .then(function() {
                srConnection.invoke("Send", JSON.stringify({ 'sdp': rtcConnection.localDescription }))
            })
        }
        else if (message.sdp.type == 'answer') {
            rtcConnection.setRemoteDescription(new RTCSessionDescription(message.sdp))
        }
    } else if (message.candidate) {
        rtcConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
    }
});

srConnection.onclose(start);

function createPeerConnection()
{
    rtcConnection = new RTCPeerConnection(null)
    rtcConnection.onicecandidate = function(event) {
        if (event.candidate) {
            // Let's send it to our peers via SignalR
            srConnection.invoke("Send", JSON.stringify({ "candidate": event.candidate }));
        }
    }
    rtcConnection.onaddstream = function(event) {
        console.log("Got a stream to add")
        otherVideo = document.getElementById('remote');

        // Attach the stream to the Video element via adapter.js
        otherVideo.srcObject = event.stream
        otherVideo.play()
    }
    rtcConnection.onnegotiationneeded = function()
    {
        console.log("Negotiation needed")
        rtcConnection.createOffer()
        .then(function(offer) {
            return rtcConnection.setLocalDescription(offer)
        })
        .then(function() {
            srConnection.invoke("Send", JSON.stringify({"sdp": rtcConnection.localDescription}))
        })
    }
}

function onStart(options) {
    video = document.getElementById(options.videoID);
    width = options.width;

    createPeerConnection()

    navigator.mediaDevices.getDisplayMedia(mediaConstraints)
        .then(function (stream) {
            video.srcObject = stream
            myVideoStream = stream

            rtcConnection.addStream(myVideoStream)
        })
        .catch(function (err) {
            console.log("An error occurred: " + err);
        });

    video.addEventListener('canplay', function () {
        if (!streaming) {
            height = video.videoHeight / (video.videoWidth / width);

            if (isNaN(height)) {
                height = width / (4 / 3);
            }

            video.setAttribute('width', width);
            video.setAttribute('height', height);
            streaming = true;
        }
    }, false);
}

window.WebCamFunctions = {
    start: (options) => { onStart(options); } 
};