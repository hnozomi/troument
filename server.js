import express from 'express'
import bodyParser from 'body-parser'
import mongoose from 'mongoose'
import List from './models/list'
import User from './models/user'
import multer from 'multer';
import AWS from 'aws-sdk';
import multerS3 from 'multer-s3';


const app = express()
const port = 3001
// const dbUrl = 'mongodb://localhost/troument'
const dbUrl = 'mongodb://localhost/crudtest'


var session = require("express-session");


app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())



app.listen(port, err => { // http://localhost:3001にサーバーがたつ
  if (err) throw new Error(err)
  else console.log(`listening on port ${port}`)
})

mongoose.connect(dbUrl, dbErr => {
  if (dbErr) throw new Error(dbErr)
  else console.log('db connected')


  // ****************************************************************///
  // ホーム画面に表示するリストを取得  コンポーネント：HOME
  // ****************************************************************///


  app.get('/api/display', (request, response) => {
    List.find({}, (err, todolists) => {
      if (err) response.status(500).send()
      else response.status(200).send(todolists)
    }).sort({ time: 1 }).populate('user')
  })

  // ****************************************************************///
  // ログインしているユーザーの情報取得  コンポーネント：HOME
  // ****************************************************************///


  app.get('/api/userinfo', (request, response) => {
    const { username } = request.query
    User.findOne({ 'user_name': username }, (err, userinfo) => {
      if (err) response.status(500).send()
      else response.status(200).send(userinfo)
    })
  })

  // ****************************************************************///
  // 悩みを投稿時、実行   コンポーネント：HOME
  // ****************************************************************///

  app.post('/api/worryadd', (request, response) => {
    const { username, title, tag, worry, resolve, status, time, worry_id } = request.body.list
    const count = 0

    User.findOne({ 'user_name': username })

      .then((result) => {
        const user = result._id
        new List({
          username,
          user,
          title,
          tag,
          worry,
          resolve,
          count,
          status,
          time,
          worry_id
        }).save((err, res) => {
          if (err) response.status(500)
          else response.status(200).send(res)
        })
      })
      .catch((err) => {
        console.log(err)
      })
  })

  // ****************************************************************///
  // 解決内容を投稿  コンポーネント：HOME
  // ****************************************************************///

  app.put('/api/resolveadd', (request, response) => {
    const { worry_id, resolve, time, status } = request.body

    List.update({ 'worry_id': worry_id }, { $set: { 'resolve': resolve, 'time': time, 'status': status } },
      { upsert: true, multi: true },
      (err) => {
        response.status(200).send({ status, time })
      }
    );
  })

  // ****************************************************************///
  // リストの内容を更新  コンポーネント：HOME
  // ****************************************************************///

  app.post('/api/listupdate', (request, response) => {
    const { resolve, time, title, tag, worry, username, user, status, worry_id, count } = request.body.detail_todolist
    List.updateOne({ 'worry_id': worry_id }, {
      $set:
      {
        'username': username, 'worry_id': worry_id, 'user': user, 'title': title,
        'count': count, 'tag': tag, 'worry': worry, 'resolve': resolve, 'status': status, 'time': time
      }
    },
      { upsert: true, multi: true },
      (err) => {
        response.status(200).send({ err })
      }
    )
  })



  // ****************************************************************///
  // いいねがされているかチェック  コンポーネント：HOME
  // ****************************************************************///

  app.get('/api/goodcheck', (request, response) => {
    const { username, _id, count } = request.query
    User.findOne({ 'goodlist': _id, 'user_name': username }).populate('goodlist')
      .then((result) => {
        response.status(200).send(result)
      })
      .catch((err) => {
        console.log(err)
      })
  })

  // ****************************************************************///
  // いいねを追加  コンポーネント：HOME
  // ****************************************************************///

  app.get('/api/goodadd', (request, response) => {
    const { username, _id, count } = request.query
    User.updateOne({ 'user_name': username }, { $push: { 'goodlist': _id } }, (req) => {
      List.updateOne({ '_id': _id }, { $set: { 'count': count } },
        { upsert: true, multi: true },
        (err) => {
          response.status(200).send({ count })
        }
      )
    })
  })

  // ****************************************************************///
  // いいねを削除  コンポーネント：HOME
  // ****************************************************************///

  app.get('/api/gooddelete', (request, response) => {
    const { username, _id, count } = request.query
    User.updateOne({ 'user_name': username }, { $pull: { 'goodlist': _id } }, (req) => {
      List.updateOne({ '_id': _id }, { $set: { 'count': count } },
        { upsert: true, multi: true },
        (err) => {
          response.status(200).send({ count })
        }
      )
    })
  })


  // ****************************************************************///
  // 選択されたリストの情報取得  コンポーネント：HOME
  // ****************************************************************///


  app.get('/api/detail_display', (request, response) => {
    const { worry_id } = request.query

    List.findOne({ 'worry_id': worry_id }, (err, JSON) => {
      if (err) response.status(500).send()
      else response.status(200).send(JSON)
    })
  })





  // ****************************************************************///
  //  選択されたリストを削除  コンポーネント：DETAIL
  // ****************************************************************///


  app.delete('/api/delete', (request, response) => {
    const { worry_id } = request.body
    List.remove({ 'worry_id': worry_id }, (err) => {
      if (err) response.status(500).send()
      else response.status(200).send('削除が完了しました')
    })
  })



  // ****************************************************************///
  // ユーザー登録　　コンポーネント：REGISTER
  // ****************************************************************///

  app.post('/api/user_create', (request, response) => {
    let { user_name, password } = request.body
    const bcrypt = require('bcrypt');
    const saltRounds = 10;

    // var hashed_password = bcrypt.hashSync(password, saltRounds);

    User.find({
      'user_name': user_name
    }).countDocuments()

      .then((result) => {
        if (result > 0) {
          response.status(200).send('同一のアカウント名が存在します')
        } else {
          const user_id = Date.now() + user_name
          password = bcrypt.hashSync(password, saltRounds);
          new User({
            user_name,
            password,
            // password,
            user_id,
            thumbnail: 'user.png'
          }).save((err, res) => {
            if (err) response.status(500)
            else response.status(200).send('追加成功')

          })
        }

      }).catch((err) => {
        console.log(err);
      });
  })

  // ****************************************************************///
  // ユーザーをログインさせる　　コンポーネント：LOGIN
  // ****************************************************************///

  app.get('/api/user_login', (request, response) => {
    const { user_name, password } = request.query
    const bcrypt = require('bcrypt');

    // Userを検索して存在すればパスワードチェック。いなければ終了

    User.findOne({
      'user_name': user_name,
      // 'password': password
    })

      .then((result) => {
        if (result) {
          console.log(result)
          const hashedPassword = result.password
          bcrypt.compare(password, hashedPassword)
            .then((isCorrectPassword) => {
              if(isCorrectPassword){
                response.status(200).send(result)
              }else{
                response.status(200).send('パスワードが一致していません')
              }
            })
          } else {
            response.status(200).send('アカウントが存在しません')
        }

      }).catch((err) => {
        console.log(err);
      });
  })

  // ****************************************************************///
  // ユーザーをログアウトさせる　　コンポーネント：LOGOUT
  // ****************************************************************///

  app.post('/api/user_logout', (request, response) => {

    if (request.session.isLoggedIn === true) {
      var session = request.session
      session.isLoggedIn = null
      response.status(200).send(session.isLoggedIn)
    } else {
      response.status(200).send(false)
    }
  })


  // ****************************************************************///
  // ログインしているユーザーのリストを取得  コンポーネント：MYPAGE
  // ****************************************************************///

  app.get('/api/mypage', (request, response) => {
    const { username } = request.query
    List.find({ 'username': username }, (err, todolists) => {
      if (err) response.status(500).send()
      else response.status(200).send(todolists)
    }).sort({ time: 1 }).populate('user')
  })


  // ****************************************************************///
  // いいねしているリストを取得  コンポーネント：MYPAGE
  // ****************************************************************///

  app.get('/api/mygoodinfo', (request, response) => {
    const { username } = request.query
    User.findOne({ 'user_name': username })
      .then(async myinfo => {
        let goodlistID = myinfo.goodlist
        let goodlist_result = []

        const result = await Promise.all(goodlistID.map(async ID => {
          const ret = await getList(ID)
          goodlist_result.push(ret)
          return ret
        }))

        response.status(200).send(result)

      })
  })

  async function getList(ID) {
    var goodlist_temp = await List.findOne({ '_id': ID }).populate('user')
      .then(goodlist => {
        return goodlist
      })
    return goodlist_temp
  }


  // ****************************************************************///
  //  アイコンの登録  コンポーネント：MYPAGE
  // ****************************************************************///

  const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_S3_SECRET_KEY,
    Bucket: 'troument'
  });

  const upload = multer({
    // dest: './helloworld/public/image' 
    storage: multerS3({
      s3: s3,
      bucket: 'some-bucket',
      metadata: function (req, file, cb) {
        cb(null, { fieldName: file.fieldname });
      },
      key: function (req, file, cb) {
        cb(null, Date.now() + file.fileName)
      }
    })
  });

  app.post('/api/files', upload.array('photos', 3), function (req, res, next) {
    res.send('Successfully uploaded ' + req.files.length + ' files!')
  })


})



/**
 * Sample HTTP server for accept fetched links data
 * [!] Use it only for debugging purposes
 *
 * How to use [requires Node.js 10.0.0+ and npm install]:
 *
 * 1. $ node dev/server.js
 * 2. set 'endpoint' at the Link Tools 'config' in example.html
 *   endpoint : 'http://localhost:8008/fetchUrl'
 *
 */


const http = require('http');
const og = require('open-graph');

class ServerExample {
  constructor({ port, fieldName }) {
    this.fieldName = fieldName;
    this.server = http.createServer((req, res) => {
      this.onRequest(req, res);
    }).listen(port);

    this.server.on('listening', () => {
      console.log('Server is listening ' + port + '...');
    });

    this.server.on('error', (error) => {
      console.log('Failed to run server', error);
    });
  }

  /**
   * Request handler
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   */
  onRequest(req, res) {
    this.allowCors(res);

    const { method, url } = req;

    if (method.toLowerCase() !== 'get') {
      res.end();
      return;
    }

    const link = decodeURIComponent(url.slice('/fetchUrl?url='.length));

    /**
     * Get available open-graph meta-tags from page
     */
    og(link, function (err, meta) {
      if (meta) {
        res.end(JSON.stringify({
          success: 1,
          meta
        }));
      } else {
        res.end(JSON.stringify({
          success: 0,
          meta: {}
        }));
        console.log(err);
      }
    });
  }

  /**
   * Allows CORS requests for debugging
   * @param response
   */
  allowCors(response) {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS,POST,PUT');
    response.setHeader('Access-Control-Allow-Headers', 'Access-Control-Allow-Headers, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers');
  }
}

new ServerExample({
  port: 8008,
  fieldName: 'link'
});