import { existsSync, mkdirSync, readdirSync } from 'fs';
import * as https from 'https';
import jsonfile from 'jsonfile';
import { Observable } from 'rxjs';

import { Action, IEAMEvent } from './interface/model';
import { HznParams } from './params/hzn-params';

const cp = require('child_process'),
exec = cp.exec;

export class Utils {
  homePath = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
  mmsPath = '/mms-shared';
  localPath = './local-shared';
  assets = './assets';
  sharedPath = '';
  intervalMS = 10000;
  timer: NodeJS.Timer = null;

  constructor() {
    this.init()
  }
  init() {
    if(!existsSync(this.localPath)) {
      mkdirSync(this.localPath);
    }
    this.resetTimer()
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
  unregister(params: HznParams) {
    return this.shell(`oh deploy autoUnregister`)
  }
  registerWithPolicy(params: HznParams) {
    return this.shell(`oh deploy autoRegisterWithPolicy`)
  }
  registerWithPattern(params: HznParams) {
    return this.shell(`oh deploy autoRegisterWithPattern`)
  }
  updatePolicy(params: HznParams) {
    return this.shell(`oh deploy autoAddpolicy`)
  }
  checkMMS() : any[] {
    try {
      let list;
      let config;
      if(existsSync(this.mmsPath)) {
        list = readdirSync(this.mmsPath);
        list = list.filter(item => /(\.zip|\.json)$/.test(item));
        this.sharedPath = this.mmsPath;  
      } else if(existsSync(this.localPath)) {
        list = readdirSync(this.localPath);
        config = list.filter(item => item === 'config.json');
        list = list.filter(item => /(\.zip|\.json)$/.test(item));
        this.sharedPath = this.localPath;
      }
      return list;  
    } catch(e) {
      console.log(e)
    }
  }
  resetTimer() {
    clearInterval(this.timer);
    this.timer = null;
    this.setInterval(this.intervalMS);  
  }
  setInterval(ms) {
    this.timer = setInterval(async () => {
      let mmsFiles = this.checkMMS(); 
      console.log('checking', mmsFiles)
      if(mmsFiles && mmsFiles.length > 0) {
        clearInterval(this.timer);
        mmsFiles.forEach(file => {
          // For now only handle json files
          if(file.indexOf('.json') > 0) {
            let arg = `mv ${this.sharedPath}/${file} ${this.assets}/config.json`
            this.shell(arg)
            .subscribe({
              next: (res) => {
              },
              complete: () => {
                console.log('complete')
                this.resetTimer()
              },
              error: (err) => {
                console.log('error', err)
                this.resetTimer()
              }
            })
          }
        });
      } else {
        clearInterval(this.timer);
        this.runTasks()
        .subscribe({
          complete: () => {
            this.resetTimer()
          },
          error: (err) => {
            this.resetTimer()
          }
        })
      }
    }, ms);
  }
  runTasks() {
    return new Observable((observer) => {
      try {
        console.log('run taks')
        let eventJson = [];
        let json = jsonfile.readFileSync(`${this.assets}/config.json`);
        let ieamEvent: IEAMEvent;
        let running = false;
        json.events.forEach((event: IEAMEvent, idx) => {
          ieamEvent = new IEAMEvent(event)
          console.log(ieamEvent.isWithinDateRange(), ieamEvent.isActionAllow(), ieamEvent.isClearToRun())
          //console.log(ieamEvent)
          if(!running && ieamEvent.isClearToRun()) {
            running = true
            switch(ieamEvent.actionType()) {
              case Action.autoRegisterWithPattern:
              case Action.autoRegisterWithPolicy: 
              case Action.autoUnregister: 
                this.isNodeConfigured()
                .subscribe((configured) => {
                  if(configured) {
                    this.shell(`oh deploy ${ieamEvent.action}`)
                    .subscribe({
                      complete: () => {
                        ieamEvent.lastRun = Date.now()
                        eventJson.push(Object.assign({},ieamEvent))
                        json.events = eventJson
                        jsonfile.writeFileSync(`${this.assets}/config.json`, json, {spaces: 2});
                        observer.next('')
                        observer.complete()  
                      },
                      error: (err) => {
                        console.log('error', err)
                        observer.error(err)
                      }
                    })
                  } else {
                    observer.next('')
                    observer.complete()  
                  }
                }) 
              break;
              default:
                running = false;
                break;
            }
          } else {
            eventJson.push(Object.assign({},ieamEvent))
          }
        });
        console.log(eventJson)
        if(!running) {
          observer.next('')
          observer.complete()  
        }
      } catch(e) {
        console.log(e)
        observer.error(e)
      }
    })
  }
  isNodeConfigured() {
    return new Observable((observer) => {
      let arg = `hzn node list`
      this.shell(arg, "Successfully list node", "Failed to list node")
      .subscribe({
        next: (res: any) => {
          console.log(typeof res == 'string')
          try {
            let json = JSON.parse(res)
            console.log(json.configstate.state)
            observer.next(json.configstate.state === 'configured')
            observer.complete()
          } catch(e) {
            observer.error(e)
          }
        }, error(e) {
          observer.error(e)
        }
      })
    })  
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