import * as https from 'https';
import { Observable } from 'rxjs';

import { utils } from '../server';
import { HznParams } from './params/hzn-params';

const cp = require('child_process'),
exec = cp.exec;

export class Utils {
  homePath = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];

  constructor() {
  }
  init() {
  }

  httpGet(url) {
    return new Observable((observer) => {
      https.get(url, (resp) => {
        let data = '';
      
        // A chunk of data has been recieved.
        resp.on('data', (chunk) => {
          data += chunk;
        });      
        // The whole response has been received. Print out the result.
        resp.on('end', () => {
          observer.next(JSON.parse(data));
          observer.complete();
        });     
      }).on("error", (err) => {
        console.log("Error: " + err.message);
        observer.error(err);
      });
    });  
  }
  unregisterAgent(params: HznParams) {
    const arg = `oh deploy unregisterAgent`
    return utils.shell(arg)
  }
  registerWithPolicy(params: HznParams) {
    const arg = `hzn exchange deployment autoRegisterWithpolicy --config_file ${params.name}`
    return utils.shell(arg)
  }
  registerWithPattern(params: HznParams) {
    const arg = `hzn exchange deployment autoRegisterWithPattern --config_file ${params.name}`
    return utils.shell(arg)
  }
  updatePolicy(params: HznParams) {
    const arg = `hzn exchange deployment autoAddpolicy --config_file ${params.name}`
    return utils.shell(arg)
  }
  shell(arg: string, success='command executed successfully', error='command failed', prnStdout=true, options={maxBuffer: 1024 * 2000}) {
    return new Observable((observer) => {
      console.log(arg);
      let child = exec(arg, options, (err: any, stdout: any, stderr: any) => {
        if(!err) {
          // console.log(stdout);
          console.log(success);
          observer.next(prnStdout ? stdout : '');
          observer.complete();
        } else {
          console.log(`${error}: ${err}`);
          observer.error(err);
        }
      });
      child.stdout.pipe(process.stdout);
      child.stdout.on('data', (data) => {
        if(data.indexOf(`Run 'hzn agreement list' to view`) > 0) {
          console.log(success);
          observer.next(prnStdout ? data : '');
          observer.complete();
        }
      })
      child.on('data', (data) => {
        console.log(data)
      })  
    });
  }
}