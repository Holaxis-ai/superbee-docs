import http from "node:http";
import https from "node:https";
import net from "node:net";
import { syncBuiltinESMExports } from "node:module";

const refuse = () => { throw new Error("Network refused by disposable package journey"); };
globalThis.fetch = async () => refuse();
http.request = http.get = https.request = https.get = refuse;
net.connect = net.createConnection = refuse;
net.Socket.prototype.connect = refuse;
syncBuiltinESMExports();
