import cors from 'cors';
import express from 'express';
import fileUpload from 'express-fileupload';
import path from 'path';
import { Observable } from 'rxjs';

import { Utils } from './common';
import { HznParams, Params } from './common/params';

export const utils = new Utils();

export class Server {
  params: Params = <Params>{};
  app = express();
  apiUrl = `${process.env.SERVERLESS_ENDPOINT}`
  constructor(private port = 3000) {
    this.initialise()
  }

  getParams(params: HznParams) {
    return Object.assign(this.params, params)
  }
  setCorsHeaders(req: express.Request, res: express.Response) {
    res.header("Access-Control-Allow-Origin", "YOUR_URL"); // restrict it to the required domain
    res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
    // Set custom headers for CORS
    res.header("Access-Control-Allow-Headers", "Content-type,Accept,X-Custom-Header");

  }
  streamData(req: express.Request, res: express.Response, parse = true) {
    let params = this.getParams(req.query as unknown as HznParams);
    let body = ''
    return new Observable((observer) => {
      req.on('data', (data) => {
        body += data
      })
      .on('close', () => {
        try {
          // console.log(body)
          let data = JSON.parse(body);
          if(!parse) {
            params.body = data
          } else {
            Object.keys(data).forEach((key) => {
              params[key] = data[key];
            })
          }
          observer.next(params)
          observer.complete()
        } catch(e) {
          observer.error(e)
        }
      })
    })
  }

  initialise() {
    let app = this.app;
    app.use(cors({
      origin: '*'
    }));
    app.use(fileUpload());
  
    app.use('/static', express.static('public'));

    app.use('/', express.static('dist/auto-dock-dashboard'))
  
    app.get('/', (req: express.Request, res: express.Response, next: any) => { //here just add next parameter
      res.sendFile(
        path.resolve(__dirname, "index.html")
      )
      // next();
    })
  
    app.get("/staff", (req: express.Request, res: express.Response) => {
      res.json(["Jeff", "Joe", "John", "Mikio", "Rob", "Sanjeev", "Susan"]);
    });
  
    app.get("/get_weather_info", (req: express.Request, res: express.Response, next) => {
      utils.httpGet(`${this.apiUrl}/get_weather_info`)
      .subscribe({
        next: (data: any) => res.send(data),
        error: (err: any) => next(err)
      })  
      // @ts-ignore
      // let weather = new Weather(req.query.weatherApiKey, req.query.geoCode, req.query.language, req.query.units);
      // let fiveDaysWeatherInfo = weather.get5DaysForecast();
      // res.send({data: fiveDaysWeatherInfo});
    });
  
    app.get("/get_crop_list", (req: express.Request, res: express.Response, next) => {
      utils.httpGet(`${this.apiUrl}/get_crop_list`)
      .subscribe({
        next: (data: any) => res.send(data),
        error: (err: any) => next(err)
      })  
    });

    app.get("/unregister", (req: express.Request, res: express.Response, next) => {
      utils.shell(`oh deploy autoUnregister`)
      .subscribe({
        next: (data: any) => res.send(data),
        error: (err: any) => next(err)
      })  
    });

    app.get("/register_with_policy", (req: express.Request, res: express.Response, next) => {
      utils.shell(`oh deploy autoRegisterWithPolicy`)
      .subscribe({
        next: (data: any) => res.send(data),
        error: (err: any) => next(err)
      })  
    });

    app.get("/register_with_pattern", (req: express.Request, res: express.Response, next) => {
      utils.shell(`oh deploy autoRegisterWithPattern`)
      .subscribe({
        next: (data: any) => res.send(data),
        error: (err: any) => next(err)
      })  
    });

    app.post('/update_config', (req: express.Request, res: express.Response, next) => {
      this.streamData(req, res)
      .subscribe({
        next: (params: Params) => {
          console.log(params)
          res.send('test')
          //this.cosClient.mkdir(params)
          //.subscribe({
          //  next: (data: any) => res.send(data),
          //  error: (err: any) => next(err)
          //})
        }, error: (err) => next(err)
      })
    })

    // app.get("*",  (req: express.Request, res: express.Response) => {
    //   res.sendFile(
    //       path.resolve( __dirname, "index.html" )
    //   )
    // });
  
    app.listen(this.port, () => {
      console.log(`Started on ${this.port}`);
    });
  }
}
