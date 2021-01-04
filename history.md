A bit of a log of how I got here...
---

I wanted to expand on the basic JS tutorial for web cam usage and incorporate Blazor and a WebRTC server so that I can start to build video chat functionality into sites.

This code is based on an article by Roman Simuta:

https://romansimuta.com/posts/using-a-web-camera-with-fun-filters-in-your-asp-net-core-blazor-webassembly-application/

With a few differences:
- the Javascript is referenced in `/Pages/_Host.cshtml` there is no `/wwwroot/index.html`

It worked first time, great! However it only shows the camera output locally, it doesn't incorporate WebRTC for collaboration. If all you need is to capture camera output on a page then this is a perfect starting point.
---

To add sharing of video and audio I used Microsoft.MixedReality.WebRTC.

https://microsoft.github.io/MixedReality-WebRTC/manual/gettingstarted.html

I think this may also handle the video and audio so I don't need to use JSInterop any more.

But it just kept failing to initialise all the time, probably because I have virtual camera and audio devices. So I went back to the JS option to build on Romans article.

Also in the events raised when a remote stream is added I couldn't find a way to get the stream. In JS it seems the stream is just passed as an event parameter.
---

This article explains the process or connecting to a SignalR hub to share streams. Basically the streams are encapsulated into opaque messages that we have to get from peer to peer. This results in a very simple hub:

https://www.skylinetechnologies.com/Blog/Skyline-Blog/February-2013/Peer-to-Peer-Media-Streaming-with-WebRTC-and-Signa

I copied some code from one of my own projects to set up SignalR:

https://github.com/aykay76/gameserver

But i'm back to needing a Javascript SignalR client, which I got from here:

https://docs.microsoft.com/en-us/aspnet/core/signalr/javascript-client?view=aspnetcore-5.0

I downloaded adapter.js which improves compatibility, following the instructions here:

https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/adapter.js
---

The code from the original example is 8 years old and some elements used have been deprecated. Such as using promises instead of success functions on the RTC client.

So, i'm back to the drawing board with this:

https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling#Handling_the_invitation

Now that I fully understand the process there were some things missing from the examples I have been following.

This repository now contains a working video sharing service with SignalR acting as the signalling server.

To turn it into a fully working video calling service I need to:
- gracefully handle start/stop of calls
- introduce UI to call and answer/reject
- handle more than 2 endpoints
- have options to turn on/off audio/video
- enumerate devices and allow user to choose camera/mic
- a nicer UI :)

Other things to do:
- rename this project
- introduce chat and drawing?

---
Other articles of use:

https://www.html5rocks.com/en/tutorials/webrtc/infrastructure/