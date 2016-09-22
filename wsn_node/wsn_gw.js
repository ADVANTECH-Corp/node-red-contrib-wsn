/**
 * Copyright 2016 Advantech
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

var util = require('util');
var exec = require('child_process').exec;

var API_PROGRAM = "/usr/bin/apimuxcli";
var API_CMD = "";
var API_RESTAPI = "";
var JSON_START_OFFSET = 3;
var JSON_START_KEYWORD = "StatusCode";
var JSON_END_KEYWORD = "eoj";


module.exports = function(RED) {
    "use strict";

    var JsonObj = null;
    var ResultJsonStr = null;
    var ErrorStr = null;

    function VerifyRestOutput(error, stdout, stderr) {
        // do basic result check
        if (error) {
            console.log("REST exec error: " + error);
            ErrorStr = "REST exec error: " + error;
            return false;
        }
        
        if (!stdout) {
            console.log("REST no result");
            ErrorStr = "REST no result";
            return false;
        }
        //console.log("REST result: " + stdout);
        
        // get json part in result output
        var JsonStartIndex = stdout.indexOf(JSON_START_KEYWORD) - JSON_START_OFFSET;
        var JsonEndIndex = stdout.lastIndexOf(JSON_END_KEYWORD);
        if (JsonStartIndex < 0 || JsonEndIndex < 0) {
            console.log("Not correct Json result:" + stdout);
            ErrorStr = "Not correct Json result";
            return false;
        }
        ResultJsonStr = stdout.substring(JsonStartIndex, JsonEndIndex);
        //console.log("WSN_GwGetX: JSON str:" + ResultJsonStr);
        
    	try {
            JsonObj = JSON.parse(ResultJsonStr);
        } catch (e) {
            console.log("Json Result parse error: " + e);
            ErrorStr = "Json Result parse error: " + e;
            return false;
        }

        if (JsonObj !== null &&
            JsonObj.hasOwnProperty('StatusCode') && 
            JsonObj['StatusCode'] === 200 &&
            JsonObj.hasOwnProperty('Result')) 
        {
            return true;
        } else {
            ErrorStr = null;
            return false;
        }
    }


    // The main node definition - most things happen in here
    function WsnGwAdv(config) {
        // Create a RED node
        RED.nodes.createNode(this, config);

        // Store local copies of the node configuration (as defined in the .html)
        var node = this;
        node.operNow = config.operNow;
        node.intfNow = config.intfNow;
        node.devNow = config.devNow;
        node.topicNow = config.topicNow;
        //node.topicNow = "Info";
        node.attribNow = config.attribNow;
        node.setvalue = config.setvalue;

        // Read the data & return a message object later
        this.read = function(msgIn) {
            node.msg = msgIn ? msgIn : {};
            var rest = '';

            rest = '"' + 'IoTGW/' + node.intfNow + '/';
            var devMac = node.devNow.split(/[\(\)]+/);
            rest = rest + devMac[1] + '/' + node.topicNow;
            if (node.attribNow !== "None") {
                rest = rest + '/' + node.attribNow;
            }
            rest = rest + '"';
            //console.log(node.operNow + " Rest CMD:" + rest);

            if (node.operNow === "Set") {
                // TODO: handle value(bv) and string(sv)
                var setValueJson = '{\"bv\":' + node.setvalue + '}';
                exec(API_PROGRAM + ' POST ' + rest + ' ' + setValueJson, function(error, stdout, stderr) {
                    var isValidResult = VerifyRestOutput(error, stdout, stderr);
                    //var msg = {};
                    if (true === isValidResult) {
                        node.msg.payload = ResultJsonStr;
                    } else {
                        if (ErrorStr === null) {
                            node.msg.payload = ResultJsonStr;
                        } else {
                            node.msg.payload = "SET " + rest + " " + node.setvalue + ". Error:" + ErrorStr;
                        }
                    }
                    //msg.topic = node.topic || node.name;
                    node.send(node.msg);		// this.send() failed, self.send() failed
                });
            } else {
                exec(API_PROGRAM + ' GET ' + rest, function(error, stdout, stderr) {
                    var isValidResult = VerifyRestOutput(error, stdout, stderr);
                    //var msg = {};
                    if (true === isValidResult) {
                        node.msg.payload = ResultJsonStr;
                    } else {
                        if (ErrorStr === null) {
                            node.msg.payload = ResultJsonStr;
                        } else {
                            node.msg.payload = "GET " + rest + ". Error:" + ErrorStr;
                        }
                    }
                    //msg.topic = node.topic || node.name;
                    node.send(node.msg);		// this.send() failed, self.send() failed
                });
            }
        };

        // respond to inputs....
        this.on('input', function(msg) {
            this.read(msg);
        });
    }
    // Register the node by name.
    RED.nodes.registerType("wsn-gw", WsnGwAdv);


    // response for HTML control
    var Items = [5];
    for (var i=0; i<5; i++) {
        Items[i] = [];
    }


    // Functions for HTML control
    RED.httpAdmin.get("/WSN_GwGetIntf/:id", function(req, res) {
        //console.log("In WSN_GwGetIntf !!");
        var restGetIntf = "IoTGW";
        
        exec(API_PROGRAM + ' GET ' + restGetIntf, function(error, stdout, stderr) {
            if (res.headersSent) {
                return;
            }

            Items[0].length = 0;
        	
            var isValidResult = VerifyRestOutput(error, stdout, stderr);
            if (true === isValidResult) {
                for (var intf in JsonObj['Result']) {
                    if (intf !== 'bn' && intf !== 'ver') {
                        Items[0].push(intf);
                    }
                }
            } else {
                Items[0].push("None");
            }

            res.send(Items);        
        });
    });


    RED.httpAdmin.get("/WSN_GwGetDev/:id/:confIntf", function(req,res) {
        //console.log("In WSN_GwGetDev !!");
        var confIntf = req.params.confIntf;
        if (confIntf === 'undefined' || confIntf === 'null') {
            console.log("GwGetDev: unknown interface !!");            
            res.send(null);
            return;
        }
        //RED.log.info(RED._("GetDev: id=" + req.params.id + " Type=" + confType + " Intf=" + confIntf));

        var restGetDev = "IoTGW/" + confIntf;

        exec(API_PROGRAM + ' GET ' + restGetDev, function(error, stdout, stderr) {
            if (res.headersSent) {
                return;
            }

            Items[1].length = 0;
        	
            var isValidResult = VerifyRestOutput(error, stdout, stderr);
            if (true === isValidResult) {
                for (var dev in JsonObj['Result']) {
                    if (dev !== 'bn' && dev !== 'ver') {
                        Items[1].push(dev + "(" + JsonObj['Result'][dev].bn + ")");
                    }
                }
            } else {
                Items[1].push("None");
            }

            res.send(Items);
        });
    });


    RED.httpAdmin.get("/WSN_GwGetTopic/:id/:confIntf/:confDev", function(req,res) {
        //console.log("In WSN_GwGetTopic !!");
        var confIntf = req.params.confIntf;        
        var confDev = req.params.confDev;
        if (confIntf === 'undefined' || confIntf === 'null' ||  
            confDev === 'undefined' || confDev === 'null') 
        {
            console.log("GwGetTopic: unknown Interface/Device !!");            
            res.send(null);
            return;
        }

        var devMac = confDev.split(/[\(\)]+/);
        //console.log("devMac[1]=" + devMac[1]);
        var restGetTopic = "IoTGW/" + confIntf + "/" + devMac[1];

        exec(API_PROGRAM + ' GET ' + restGetTopic, function(error, stdout, stderr) {
            if (res.headersSent) {
                return;
            }

            Items[2].length = 0;
        	
            var isValidResult = VerifyRestOutput(error, stdout, stderr);
            if (true === isValidResult) {
                for (var topic in JsonObj['Result']) {
                    if (topic !== 'bn' && topic !== 'ver') {
                        Items[2].push(topic);
                    }
                }
            } else {
                Items[2].push("None");
            }

            res.send(Items);
        });
    });


    RED.httpAdmin.get("/WSN_GwGetAttrib/:id/:confOper/:confIntf/:confDev/:confTopic", function(req,res) {
        //console.log("In WSN_GwGetAttrib !!");
        var confOper = req.params.confOper;
        var confIntf = req.params.confIntf;        
        var confDev = req.params.confDev;
        var confTopic = req.params.confTopic;
        //RED.log.info(RED._("GetAttrib: id=" + req.params.id + " Intf=" + confIntf + " Dev=" + confDev + " Topic=" +confTopic));
        if (confOper === 'undefined' || confOper === 'null' || 
            confIntf === 'undefined' || confIntf === 'null' || 
            confDev === 'undefined' || confDev === 'null' ||
            confTopic === 'undefined' || confTopic === 'null') 
        {
            console.log("GwGetAttrib: unknown Oper/Interface/Device/Topic!!");            
            res.send(null);
            return;
        }

        var devMac = confDev.split(/[\(\)]+/);
        var restGetAttrib = "IoTGW/" + confIntf + "/" + devMac[1] + "/" + confTopic;
        //console.log("restGetAttrib=" + restGetAttrib);

        exec(API_PROGRAM + ' GET ' + restGetAttrib, function(error, stdout, stderr) {
            if (res.headersSent) {
                return;
            }

            Items[3].length = 0;
            var isEmptyList = true;

            var isValidResult = VerifyRestOutput(error, stdout, stderr);
            if (true === isValidResult) {
                for (var attrib in JsonObj['Result']['e']) {
                    //console.log(util.inspect(msgJson['Result']['e'][attrib], {showHidden: false, depth: null}));
                    if (confOper === "Set") {
                        var result = JsonObj['Result']['e'][attrib]['asm'].indexOf("w");
                        //console.log("SN_GetAttrib: check write permission:" + result); 
                        if (result === -1) {
                            continue;
                        }
                    }
                    Items[3].push(JsonObj['Result']['e'][attrib]['n']);
                    isEmptyList = false;
                }
            } else {
                Items[3].push("None");
            }

            //console.log("final result" + result);
            if (isEmptyList === true) {
                Items[3].push("None");
            }

            res.send(Items);
        });
    });

}

