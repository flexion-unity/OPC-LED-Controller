# Extension for local recording in OPC
Include FLXOPCRecorder.pde in your [Processing] project and add the following code to initialize local recording of data sent to the fadecandy server:

```sh
OPCRecorder opcrecorder;

void setup() {
   size(800, 500);
   capturer = new ScreenCapturer(width, height, 20);
   opc = new OPC(this, "172.16.1.1", 7890);

   // Record current OPC output to local file
   opcrecorder = new OPCRecorder(this, "e:\\opc.video\\out.opc");
   opcrecorder.setFrameRate(20);
   opc.enableOPCRecording(true);
}
```

# Modifcation of OPC.pde
To support capturing of data sent to fadecandy, modify your OPC.pde at the bottom of function "draw()" just before the call to writePixels(). (OPC.pde can be found in the code samples of [fadecandy])

```sh
    // Write to local file
    opcrecorder.writePixelFrame(packetData);
```


[fadecandy]:https://github.com/scanlime/fadecandy/
[Processing]:https://processing.org
