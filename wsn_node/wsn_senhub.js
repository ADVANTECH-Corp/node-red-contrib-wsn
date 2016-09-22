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
    function WsnSenhubAdv(config) {
        // Create a RED node
        RED.nodes.createNode(this, config);

        // Store local copies of the node configuration (as defined in the .html)
        var node = this;
        node.operNow = config.operNow;
        node.intfNow = config.intfNow;
        node.devNow = config.devNow;
        node.topicNow = config.topicNow;
        //node.attribNow = config.attribNow;
        node.attribNow = config.attribSaved;
        node.setvalue = config.setvalue;
        //console.log("start config=", config);

        // Read the data & return a message object later
        this.read = function(msgIn) {
            node.msg = msgIn ? msgIn : {};
            var rest = "";
            rest = '"' +  node.devNow + '/SenHub/' + node.topicNow + '/' + node.attribNow + '"';
            //console.log("REST:" + rest);
            //console.log("input msg.payload=" + node.msg.payload);

            if (node.operNow === "Set") {
                // TODO: handle value(bv) and string(sv)

                var setValueJson = null;
                var isValidInputPayload = false;
                var inputJsonObj = null;
                if (msgIn.payload) {
                    try {
                        inputJsonObj = JSON.parse(msgIn.payload);
                        if (inputJsonObj !== null && inputJsonObj !== undefined &&
                            inputJsonObj.hasOwnProperty('Action') &&
                            inputJsonObj.hasOwnProperty('Value') &&
                            inputJsonObj['Action'] === 'Set')
                        {
                            setValueJson = '{\"bv\":' + inputJsonObj['Value'] + '}';
                            isValidInputPayload = true;
                        }
                    } catch (e) {
                        console.log("Input Json:" + msgIn.payload + " :parse error: " + e);
                    }
                }

                if (isValidInputPayload === false) {
                    if (node.setvalue !== null) {
                        //console.log("Invalid input from prev node, use setvalue in config");
                        setValueJson = '{\"bv\":' + node.setvalue + '}';
                    } else {
                        //console.log("both input are invalid, return");
                        return;
                    }
                }
                //console.log("final set value=" + setValueJson);

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
    RED.nodes.registerType("wsn-senhub", WsnSenhubAdv);


    // response for HTML control
    var Items = [5];
    for (var i=0; i<5; i++) {
        Items[i] = [];
    }


    // Functions for HTML control
    RED.httpAdmin.get("/WSN_SnGetIntf/:id", function(req,res) {
        //console.log("In WSN_SnGetIntf !!");
        var restGetIntf = "IoTGW";

        exec(API_PROGRAM + ' GET ' + restGetIntf, function(error, stdout, stderr) {
            if (res.headersSent) {
                return;
            }

            Items[0].length = 0;

            var isValidResult = VerifyRestOutput(error, stdout, stderr);
            if (true === isValidResult) {
                for (var intf in JsonObj['Result']) {
                    for (var tgIntf in JsonObj['Result'][intf]) {
                        if (tgIntf !== 'bn' && tgIntf !== 'ver') {
                            var opt = intf + "/" + tgIntf + "(" + JsonObj['Result'][intf][tgIntf].bn + ")";
                            Items[0].push(opt);
                        }
                    }
                }
            } else {
                Items[0].push("None");
            }

            res.send(Items);
        });  
    });


    RED.httpAdmin.get("/WSN_SnGetDev/:id/:confIntf", function(req,res) {
        //console.log("In WSN_SnGetDev !!");

        var confIntf = req.params.confIntf;
        if (confIntf === 'undefined' || confIntf === 'null') {
            console.log("SnGetDev: unknown interface !!");            
            res.send(null);
            return;
        }
        //RED.log.info(RED._("GetDev: id=" + req.params.id + " Type=" + confType + " Intf=" + confIntf));

        var restGetDev = null;
        var gwMac = null;

        var intfStrs = confIntf.split(/[\-]+/);
        //console.log(intfStrs[0] + " " + intfStrs[1]);            
        restGetDev = "IoTGW/" + intfStrs[0] + "/" + intfStrs[1] + "/Info/SenHubList";
        //console.log("restGetDev=" + restGetDev);
        gwMac = intfStrs[1];
        //console.log("gwMac=" + gwMac);

        exec(API_PROGRAM + ' GET ' + restGetDev, function(error, stdout, stderr) {
            if (res.headersSent) {
                return;
            }

            Items[1].length = 0;

            var isValidResult = VerifyRestOutput(error, stdout, stderr);
            if (true === isValidResult) {
                if (JsonObj['Result']['sv'] === undefined) {
                    //console.log("JsonObj['Result']=" + util.inspect(JsonObj['Result'], {showHidden: false, depth: null}));
                    Items[1].push("None");
                } else {
                    var devList = JsonObj['Result']['sv'].split(/[\,]+/);
                    for (var i=0; i<devList.length; i++) {
                        if (devList[i] !== gwMac) {
                            Items[1].push(devList[i]);
                        }
                    }
                }
            } else {
                Items[1].push("None");
            }

            res.send(Items);
        });
    });


    RED.httpAdmin.get("/WSN_SnGetTopic/:id/:confIntf/:confDev", function(req,res) {
        //console.log("In WSN_SnGetTopic !!");
        var confIntf = req.params.confIntf;        
        var confDev = req.params.confDev;
        if (confIntf === 'undefined' || confIntf === 'null' ||  
            confDev === 'undefined' || confDev === 'null') 
        {
            console.log("SnGetTopic: unknown Interface/Device !!");            
            res.send(null);
            return;
        }

        var restGetTopic = confDev + "/SenHub";
        //console.log("restGetTopic=" + restGetTopic);

        exec(API_PROGRAM + ' GET ' + restGetTopic, function(error, stdout, stderr) {
            if (res.headersSent) {
                return;
            }

            Items[2].length = 0;

            var isValidResult = VerifyRestOutput(error, stdout, stderr);
            if (true === isValidResult) {
                //console.log("WSN_SnGetTopic: JsonObj['Result']=" + util.inspect(JsonObj['Result'], {showHidden: false, depth: null}));
                for (var topic in JsonObj['Result']) {
                    if (topic !== 'bn' && topic !== 'ver') {  // ver: call lib API with command "GET mac/SenHub/ver" returns 404
                        Items[2].push(topic);
                    }
                }
            } else {
                Items[2].push("None");
            }

            res.send(Items);
        });
    });

    RED.httpAdmin.get("/WSN_SnGetAttrib/:id/:confOper/:confIntf/:confDev/:confTopic", function(req,res) {
        //console.log("In WSN_SnGetAttrib !!");
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
            console.log("SnGetAttrib: unknown Oper/Interface/Device/Topic!!");            
            res.send(null);
            return;
        }

        var restGetAttrib = confDev + "/SenHub/" + confTopic;
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

