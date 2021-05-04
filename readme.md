# WebRTC with Blazor WASM

I created this project as a reference for WebRTC and a base implementation of it in case I need it for future projects. Before HTML5 the only options were to use Flash or Silverlight to be able to share multimedia content on the web and that was prohibitive for me as a hobby developer. WebRTC isn't new, but it's newer than my last attempts to do similar things.

I started with a BlazorServer project because i'm a big fan of C# and want to use that as much as possible, instead of having to switch between C# on the server side and Javascript on the front end. However, I have found that some functionality still isn't yet supported in WASM so Blazor Server seems to be the best approach for me.

Create a blazor server by creating an empty directory and running:

`dotnet new blazorserver`

This creates a template application with a simple navigation system and some example pages. These can be deleted if not required, to keep the project clean.

Having read a little about WebRTC I knew that a signalling server is required. This correlates events or instructions between the clients of a WebRTC session. The ideal choice for this, IMHO, is SignalR as it fits with the ASP.NET ecosystem and is simple to implement (I have another example of using it in a game server [here](https://github.com/ayay76/gameserver)).

To incorporate SignalR run:

`dotnet add package Microsoft.AspNetCore.SignalR.Client --version 5.0.1` (replacing the version with the latest, or a specific version you require)

Configuring SignalR in this project is quite simple. To save bouncing around lots of tutorials I will provide a link here and the basic steps I followed to make it work:

## SignalR

The first step is to tell your ASP.NET application to use SignalR. In the `ConfigureServices` method of your `Startup.cs` file add the following:

```cs
    public void ConfigureServices(IServiceCollection services)
    {
        services.AddSignalR(); // add signalr
        services.AddRazorPages();
        services.AddServerSideBlazor();
    }
```

Then in the `Configure` method add the following to the UseEndpoints block of code:

```cs
    app.UseEndpoints(endpoints =>
    {
        endpoints.MapBlazorHub();
        endpoints.MapHub<WebRtcService>("/webrtc"); // map an endpoint to a SignalR service
        endpoints.MapFallbackToPage("/_Host");
    });
```

Then you need to add a SignalR hub that will respond to calls to the `/webrtc` endpoint. For this I create a folder called `Services` and create a class that is passed into the `MapHub` call.

It's important that this class is a subclass of Hub, which is defined in the `Microsoft.AspNetCore.SignalR` namespace:

```cs
    public class WebRtcService : Hub
    {
        public async Task Send(string message)
        {
            Console.WriteLine(message);
            await Clients.Others.SendAsync("Receive", message);
        }
    }
```

This class is very simple, it contains one method which I will explain later. The `Send` method basically receives messages a client wishes to send. When a client sends a message SignalR will then tell all other clients to receive it.

The last step is to enable SignalR on the client side. This requires downloading a Javascript SignalR client and referencing it in the host HTML file.

You can reference it directly from CDN using the following HTML:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/microsoft-signalr/3.1.7/signalr.min.js"></script>
```
(I downloaded it and referenced it locally, personal preference 😊, if you want to do this download the file to the `/wwwroot` directory of your project)

The reference in `/Pages/_Host.cshtml` can be added below the reference to `_framework/blazor.server.js`:

```html
    <script src="_framework/blazor.server.js"></script>
    <script src="js/signalr.js"></script>
```
This completes adding SignalR to your project, it is now ready for use by your WebRTC client.

## WebRTC

Now let's get down to what this project is about; sharing video, audio and desktop content with WebRTC. The first step is to lay out some HTML components in the `Index.razor` page that will contain the video, and a button to initiate a call.
At this point I should say that this is a contrived project assuming two clients connected to the same page and one of the clients initiating a call. There is no authentication, no user lists to choose who to call, that's your homework to extend this if you wish 👍.

So in `/Pages/Index.razor` add the following:

```
<div>
    <button @onclick="Start">Start</button>
</div>
<div>
    <video id="@options.VideoID"
        style="background-color:lightblue;"
        width="@options.Width" autoplay="true">Click start to show video
    </video>
    <video id="remote"
        style="background-color:lightblue;"
        width="@options.Width" autoplay="true">Click start to show video
    </video>
</div>
@code{
    WebCamOptions options = new WebCamOptions() 
    { 
        CanvasID = "canvas",
        VideoID = "video"
    };

    protected override void OnInitialized()
    {
        options.Width = 480;
    }

    public async Task Start()
    {
        await JSRuntime.InvokeVoidAsync("WebCamFunctions.start", options);
    }
}
```

The options code isn't necessary, it's a hangover from a [tutorial](https://romansimuta.com/posts/using-a-web-camera-with-fun-filters-in-your-asp-net-core-blazor-webassembly-application/) I started looking at which showed how to capture webcam from Blazor. I'm lazy and didn't remove it 😜

You'll see that clicking the start button uses the JS interop runtime to call a Javascript function. This could of course be replaced with a simple button that calls Javascript directly.

Add another Javascript file to your project and put it in the `/wwwroot` folder, referencing it from your HTML as with SignalR above. I called mine `webcam.js`.

The first thing I do when the page loads is to ensure i'm connected (and stay connected) to SignalR on the server:

```js
const srConnection = new signalR.HubConnectionBuilder()
    .withUrl("/webrtc")
    .configureLogging(signalR.LogLevel.Information)
    .build();

// automatically reconnect on close
srConnection.onclose(start);

// define (re)start function
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
```
The above code connects the SignalR client to the `/webrtc` path defined in `Startup.cs`. If the connection closes it will be re-established, and the initial connection is started.

Next, I wire up the WASM->JS interop code:
```js
window.WebCamFunctions = {
    start: (options) => { onStart(options); } 
};

function onStart(options) {
    video = document.getElementById(options.videoID);
    width = options.width;

    createPeerConnection()

    navigator.mediaDevices.getUserMedia(mediaConstraints)
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
```
The `onStart` function will create a WebRTC peer connection which will then interact with the signalling server to handle the RTC traffic. It then gets the user media stream and adds it to the connection. At the same time it populates one of the video elements in HTML so that the caller has a preview of their video.

<em>I don't think the `canplay` event is actually used, other than to set the size of the video based in the options passed from WASM. It could probably be removed.</em>

This starts the ICE process which will negotiate the correct candidate for media streaming. The MDN article [here](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling#signaling_transaction_flow) can explain it much better than I can. I know I said I would put everything in one place here but it's background, not essential to get this working.

The code to create a peer connection will handle the flow of the negotiation, offers and answers that are used to establish the call:

```js
function createPeerConnection()
{
    rtcConnection = new RTCPeerConnection(null)
    
    rtcConnection.onicecandidate = function(event) {
        if (event.candidate) {
            // send to peers over SignalR
            srConnection.invoke("Send", JSON.stringify({ "candidate": event.candidate }));
        }
    }

    rtcConnection.onaddstream = function(event) {
        otherVideo = document.getElementById('remote');

        // Attach the stream to the Video element via adapter.js
        otherVideo.srcObject = event.stream
        otherVideo.play()
    }

    rtcConnection.onnegotiationneeded = function()
    {
        rtcConnection.createOffer()
        .then(function(offer) {
            return rtcConnection.setLocalDescription(offer)
        })
        .then(function() {
            srConnection.invoke("Send", JSON.stringify({"sdp": rtcConnection.localDescription}))
        })
    }
}
```

The `onicecandidate` event handler will send the candidate to SignalR, which will ensure it sends it to all connected clients. All clients will store all candidates so that a suitable channel can be used for communication between any clients.

The `onaddstream` event needs work. In this contrived example it will simply set the other video element in HTML to show the incoming stream. In multi-party chat you would want multiple (dynamic) video elements and to manage which element corresponds to which client.

The `onnegotiationneeded` event will create an offer. This is essentially offering the video stream to clients. This is 'calling another user' and we can see how they choose to accept the call or not.

It's worth noting at this point the specific line:

```js
srConnection.invoke("Send", JSON.stringify({"sdp": rtcConnection.localDescription}))
```

This demonstrates two things:

1. The invocation of the Send method in our SignalR service class from the client. The first parameter matches the name of the method, each following parameter is an argument to that method.
2. In this case we have one which is a JSON format string representing an object that contains the video stream description. This could be augmented with additional information about the sending user, the intended recipient etc.

So, how does the callee know when a call has been made? Remember the SignalR server will call `Receive` on each connected client? We add that to the SignalR client in Javascript:

```js
srConnection.on("Receive", data => {
    var message = JSON.parse(data)

    if (message.sdp) {
        if (message.sdp.type == 'offer') {
            createPeerConnection()
            rtcConnection.setRemoteDescription(new RTCSessionDescription(message.sdp))
            .then(function () {
                return navigator.mediaDevices.getUserMedia(mediaConstraints);
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
```

When the SignalR client receives a message from the server, and the SDP message type is `offer` then it creates its own RTC peer connection and configures it with the received stream details. (This example assumes automatic answering of the call, you would want to incorporate some form of UI to answer or reject the call)

The client then creates an answer, sets the local description (for the callee video stream) and sends it to the signalling server.

You can also see in the above code the caller will receive the `answer` SDP type and set the remote description to the callee video stream description.

This completes the negotiation and the clients will then communicate with each other - no more code required from you, other than to handle reconnects etc.

** It's important to note that this will only work in a scenario where each client can communicate directly with each other. If you want to use this over the internet where clients are behind NAT devices (not in DMZ) then you will need to connect via a TURN/STUN server **

One last thing is to add the WebRTC adapter code to your project, which improves compatibility with certain browsers, and adds lots of other functionality that I haven't yet fully explored.

## Additional notes

- To use this over a network you must use HTTPS for your web hosting. The only exception to this is localhost, for local testing you can use HTTP.
- You can replace `getUserMedia` with `getDisplayMedia` to share screen instead of video.
- You can choose a specific device to share by first calling `navigator.mediaDevices.enumerateDevices()` and handling user selection.
- You can specify whether to share audio/video by adjusting the `mediaConstraints` object fields declared at the top of `webcam.js`

The full tutorial on how to do this can be found [here on the Mozilla Developer Network](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling#Handling_the_invitation)

I was amazed at how simple this was to set up. I hope it serves as a useful starter for you also. Please feel free to fork this repository, I would be interested to hear any enhancements I haven't thought of.

