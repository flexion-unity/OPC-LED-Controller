# OPC-LED-Controller
LED pixel controller with mobile webinterface for playback of recorded OPC fadecandy files. Runs on [node.js].

# What exactly is OPC-LED-Controller
This piece of software will allow you to playback previously recorded OPC (Open-Pixel-Control) animations sent to a local or remote fadecandy server. To capture animation data, a modified OPC library will capture live output sent from your [Processing] client to the fadecandy server and save the OPC LED data stream in a local file. This will allow you to capture various LED animations and store the raw data output in a file for later playback by the OPC-LED-Controller.
In the web interface, OPC video files can be organized in playlists for playback at a specified time.

# Requirements
Lots of Neopixel LED stripes (or compatible) connected to [fadecandy] USB adapter(s), a [fadecandy] server installed on a raspberry pi server or any other linux device, and [node.js] to run OPC-LED-Controller.

# Web interface

![webinterface](/doc/screenshot_webinterface_01.png?raw=true "Screenshot 1")
![webinterface](/doc/screenshot_webinterface_02.png?raw=true "Screenshot 2")

# Eye candy
Videos of the OPC-LED-Controller connected to a NeoPixel LED window panel.

* NeoPixel Panel [Video](https://www.youtube.com/watch?v=yShuQpUOM44)
* OPC-LED-Controller setup [Video](https://www.youtube.com/watch?v=C-R0qOiEBWI) 
* Capturing video playback in processing client [Video](https://www.youtube.com/watch?v=MzDn-qfUKUI)



[node.js]:http://nodejs.org
[fadecandy]:https://github.com/scanlime/fadecandy/
[Processing]:https://processing.org
