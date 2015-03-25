import com.onformative.screencapturer.*;
ScreenCapturer capturer;
OPC opc;
OPCRecorder opcrecorder;

int delayrecording = 400;
void setup() {
   size(800, 500);
   capturer = new ScreenCapturer(width, height, 24); // 30 = framerate of the capture
  
   opc = new OPC(this, "172.16.4.14", 7890);

 // by flx:
  opc.setLocalPlayback(false); // allow pixel drawing even without fcserver connection 
 
   // LED Mapping as per 17.01.2015 (trimmed)
   float hspacing = 7;
   float rotation = PI/2;
   int a=0;
   int LEDc=15;
   int w=0;
   int h=0;
   for (int r=0; r<16; r++) {
    opc.ledStrip(a, LEDc, 50 - w, 420 - h, hspacing, rotation, true);
    a+=LEDc; 
    LEDc+=3;  
    w-=40; //40
    h+=10; 
   // if (r==7) a=512; // next panel
   } 
   
 // record current OPC output to local file
 opcrecorder = new OPCRecorder(this, "e:\\opc.video\\out.opc");
 opcrecorder.setFrameRate(20);
 opc.enableOPCRecording(true);
 opc.recordingEnabled=false;
}

void draw() {
  image(capturer.getImage(), 0, 0);
  if (delayrecording>0) {
    delayrecording-=1;
    println("Delay: " + delayrecording);
  } 
  if (delayrecording==1) { 
      println("START RECORDING!");
      opc.recordingEnabled=true;
   }
}
