/*
 * Open Pixel Control recording extension for Processing.
 * Record OPC pixel animations to a local file.
 * 
 * flexion 2015
 * 
 * Version: 25.03.2015 - 17:10
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); 
 * you may not use this file except in compliance with the License. 
 * You may obtain a copy of the License at:
 * 
 * http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software 
 * distributed under the License is distributed on an "AS IS" BASIS, 
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or 
 * implied. See the License for the specific language governing 
 * permissions and limitations under the License.
 */

import java.io.FileOutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;

public class OPCRecorder {

  String fileName;
  boolean fileReady;
  boolean recordingFailed;
  String file_header;
  int frameLength;
  int frameRate=5;
  byte[] bFrame;
  FileOutputStream fos;

  Socket socket;
  OutputStream output; // for fcserver
  String host;
  int port;
    
  OPCRecorder(PApplet parent, String oFilename) {
     this.fileName = oFilename; 
  }
  void setFrameRate(int fr) {
    frameRate(fr);
    this.frameRate = fr;
  }
   
  // -------- RECORDING --------------------------
  
  void prepareFileForRecording() {
    // Note: length of frame data must be already known when creating the file! 
    fileReady = false;
    if (frameLength < 1) {
     System.out.println("Unable to record to file, because frame length is unknown or zero");
     return; 
    }
    println("-- Prepare OPC movie output file: " + this.fileName);
    File file = new File(this.fileName);
     try {
       // File header consists of:
       // flx.opc.movie (14 bytes) + [version (1 byte)] + [framerate ms (4 byte)] + [framelength (4 byte)] followed by [framedata] + [framedata] + ...
       fos = new FileOutputStream(file);
       
       // 1) Header format identification
       String hdr = "flx.opc.movie.v001";
       byte[] headerInBytes = hdr.getBytes(); 
       fos.write(headerInBytes);
      
       // 2) write "framerate" to header
       byte[] bDelay = ByteBuffer.allocate(4).order(ByteOrder.LITTLE_ENDIAN).putInt(frameRate).array();
       fos.write( bDelay );
       
       // 3) write length of pixel data frame stream
       byte[] bBuf = ByteBuffer.allocate(4).order(ByteOrder.LITTLE_ENDIAN).putInt(frameLength).array();
       fos.write( bBuf );
       
       fileReady = true; 
       
       println("-- Header written to output file");
      
     } catch (IOException e) {
       return;
     }
  }
  
  void stopRecording() {
    System.out.println("-- Closing output file");
    try {
      if (fos!=null) fos.close();
     } catch (IOException e) {
       return;
     } 
  }
  void writePixelFrame(byte[] frameData) {
    if (recordingFailed) return;
    if (!fileReady) {
      frameLength = frameData.length;
      prepareFileForRecording();
      if (!fileReady) {
        stopRecording();
        recordingFailed = true; // stop processing
        return;
      }
    }
    try {
      fos.write(frameData);
    } catch (IOException e) {
       return;
    }    
  }
  
}
