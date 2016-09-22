/**
 * Copyright 2015 Brendan Murray
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

// Dependency - dht sensor package
//var susiLib = require("node-susi");
var net = require('net');

var HOST = '127.0.0.1';
var PORT = 5000;

//var hasRestAnswer = false;

module.exports = function(RED) {
	"use strict";

	// The main node definition - most things happen in here
	function susiHWM(config) {
		// Create a RED node
		RED.nodes.createNode(this, config);

		// Store local copies of the node configuration (as defined in the .html)
		var node = this;
        	node.topic = config.topic;
		console.log(node.topic);
		node.srcuri = config.srcuri;
		console.log(node.srcuri);
		node.hasRestAnswer = false;


		var client = new net.Socket();
		/*
		client.connect(PORT, HOST, function() {
		    console.log('CONNECTED TO: ' + HOST + ':' + PORT);
		}); */

		//var msgJsonObj;

		client.on('data', function(data) {
			//var msgJsonObj;    

			console.log('DATA from Server: ' + data);
			// Close the client socket completely
			//client.destroy();
			try {
				node.msgJsonObj = JSON.parse(data);
			} catch (e) {
				console.log('JSON parse error: ' + e);
			}
		    
			node.hasRestAnswer = true;
		});

		client.on('close', function() {
		    console.log('Connection closed');
		});

		//var msg;

		function checkRestResult() {
			if (node.hasRestAnswer) {
				// parse JSON content
				//process.exit();
				var msg = {};
				//msg.payload = msgJsonObj;
				
				//msg.payload = 'marco tst';
				msg.payload = JSON.stringify(node.msgJsonObj);
				msg.topic = node.topic || node.name;

				node.hasRestAnswer = false;
				client.destroy();
				node.send(msg);		// this.send() failed, self.send() failed
			}

			setImmediate(checkRestResult);
		}

		
		
	        // Read the data & return a message object
        	this.read = function(msgIn) {			
			//var msg = msgIn ? msgIn : {};
			node.msg = msgIn ? msgIn : {};

			client.connect(PORT, HOST, function() {
			    console.log('CONNECTED TO: ' + HOST + ':' + PORT);
			}); 
		
			//console.log('1' + this.srcuri);	// work
			//console.log('3' + node.srcuri);	// work
			//client.write("GET IoTGW/WSN/0001852CF4B7B0E8/Info/SenHubList");
			client.write("GET " + config.srcuri);
			setImmediate(checkRestResult);
			console.log('waiting for rest result');
			//msg.payload = susiLib.getHardwareMonitor(config.functiontype, config.index);	
			//msg.topic    = node.topic || node.name;

			//return msg;
        	};

        	// respond to inputs....
	        this.on('input', function (msg) {
			this.read(msg);
			 
			//if (msg)
			//	node.send(msg);
        	});

		//   var msg = this.read();

	//   // send out the message to the rest of the workspace.
	//   if (msg)
	//      this.send(msg);
	}

	// Register the node by name.
	RED.nodes.registerType("WSN-GET-RAW", susiHWM);
	/*
	RED.httpAdmin.get("/SUSI-HardwareMonitor", function(req,res) {
		var Items = [4];
		for (var i=0; i<4; i++) {
			Items[i] = [];
		}
		for (var i=0; i<10; i++) {
			Items[0].push(susiLib.getHardwareMonitorString(0, i));
		}
		for (var i=0; i<10; i++) {
			Items[1].push(susiLib.getHardwareMonitorString(1, i));
		}
		for (var i=0; i<23; i++) {
			Items[2].push(susiLib.getHardwareMonitorString(2, i));
		}
		for (var i=0; i<3; i++) {
			Items[3].push(susiLib.getHardwareMonitorString(3, i));
		}
		res.send(Items);
    });*/
}
