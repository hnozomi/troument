import express from 'express'
import bodyParser from 'body-parser'
import mongoose from 'mongoose'
import List from './models/list'
import User from './models/user'
import multer from 'multer';
import AWS from 'aws-sdk';
import multerS3 from 'multer-s3';
// var multerS3 = require('multer-s3');
// var AWS = require('aws-sdk');
import { getMaxListeners } from 'process'
import { timeStamp } from 'console'


const app = express()
const port = 3001
const dbUrl = 'mongodb://18.181.201.30/troument'
// const dbUrl = 'mongodb://localhost/crudtest'
const ObjectId = require('mongodb').ObjectID;


var session = require("express-session");
var MongoStore = require('connect-mongo')(session);

app.use(session({
  secret: 'secret',
  resave: false,
  saveUninitialized: false,
  store: new MongoStore({
    url: 'mongodb://localhost/crudtest',
  }),
  cookie: {
    httpOnly: false,
    secure: false,
    maxage: 1000 * 60 * 30
  }
}));

var loginCheck = function (req, res, next) {
  if (req.session.username) {
    next();
  } else {
    res.redirect('/login');
  }
};

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())


app.get("/api/session", function (request, response) {
  response.send(request.session.username);
});


mongoose.connect(dbUrl, dbErr => {
  if (dbErr) throw new Error(dbErr)
  else console.log('db connected')


  // ****************************************************************///
  // HOME / コンポーネント
  // ****************************************************************///


  app.get('/api/display', (request, response) => {
    List.find({}, (err, todolists) => {
      if (err) response.status(500).send()
      else response.status(200).send(todolists)
    }).sort({ time: 1 }).populate('user')
  })

  app.get('/api/userinfo', (request, response) => {
    const { username } = request.query
    User.find({ 'user_name': username }, (err, userinfo) => {
      if (err) response.status(500).send()
      else response.status(200).send(userinfo)
    })
  })

  // 悩みの投稿

  app.post('/api/worryadd', (request, response) => {
    const { username, title, tag, worry, resolve, status, time, worry_id } = request.body.list
    console.log(request.body, 'worryadd')
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
          console.log(res, 'res', result)
          if (err) response.status(500)
          else response.status(200).send(res)
        })
      })
      .catch((err) => {
        console.log(err)
      })
})

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




// いいねの数を更新

// app.post('/api/count', (request, response) => {
//   const { username, worry_id, count } = request.body

//   List.updateOne({ 'worry_id': worry_id }, { $set: { 'count': count } },
//     { upsert: true, multi: true },
//     (err) => {
//       console.log('countup')
//       response.status(200).send({ count })
//     }
//   );
// })


app.get('/api/goodcheck', (request, response) => {
  const { username, _id, count } = request.query
  // User.find({ 'user_name': username, 'goodlist': _id}).countDocuments()
  User.find({ 'goodlist': _id, 'user_name': username }).populate('goodlist')
    .then((result) => {
      response.status(200).send(result)
    })
    .catch((err) => {
      console.log(err)
    })
})

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
// DELETE コンポーネント
// ****************************************************************///


app.get('/api/detail_display', (request, response) => {
  const { worry_id } = request.query

  List.findOne({ 'worry_id': worry_id }, (err, JSON) => {
    if (err) response.status(500).send()
    else response.status(200).send(JSON)
  })
})



// 解決方法を投稿

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
//  HOME / DETAIL コンポーネント
// ****************************************************************///


// LISTからデータを削除

app.delete('/api/delete', (request, response) => {
  const { worry_id } = request.body
  List.remove({ 'worry_id': worry_id }, (err) => {
    if (err) response.status(500).send()
    else response.status(200).send('削除が完了しました')
  })
})



// ****************************************************************///
// REGISTER コンポーネント
// ****************************************************************///

app.post('/api/user_create', (request, response) => {
  const { user_name, password } = request.body

  User.find({
    'user_name': user_name
  }).countDocuments()

    .then((result) => {
      if (result > 0) {
        response.status(200).send('同一のアカウント名が存在します')
      } else {
        const user_id = Date.now() + user_name
        new User({
          user_name,
          password,
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


app.get('/api/user_login', (request, response) => {
  const { user_name, password } = request.query

  User.findOne({
    'user_name': user_name,
    'password': password
  })

    .then((result) => {
      if (result === null) {
        response.status(200).send(result)
      } else {
        var session = request.session
        var thumbnail = result.thumbnail
        session.isLoggedIn = true
        response.status(200).send(result)
      }

    }).catch((err) => {
      console.log(err);
    });
})


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
// Mypage コンポーネント
// ****************************************************************///

app.get('/api/mypage', (request, response) => {
  const { username } = request.query
  List.find({ 'username': username }, (err, todolists) => {
    if (err) response.status(500).send()
    else response.status(200).send(todolists)
  }).sort({ time: 1 }).populate('user')
})

app.get('/api/myinfo', (request, response) => {
  const { username } = request.query
  User.findOne({ 'user_name': username }, (err, myinfo) => {
    if (err) response.status(500).send()
    else response.status(200).send(myinfo)
  })
})



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
// 
// ****************************************************************///

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID, 
  secretAccessKey: process.env.AWS_S3_SECRET_KEY,
  Bucket: troument
});

const upload = multer({ 
  // dest: './helloworld/public/image' 
  storage: multerS3({
    s3: s3,
    bucket: 'some-bucket',
    metadata: function (req, file, cb) {
      cb(null, {fieldName: file.fieldname});
    },
    key: function (req, file, cb) {
      cb(null, Date.now() + file.fileName)
    }
  })
});

app.post('/api/files', upload.fields([{ name: 'Files' }]), (req, res) => {
  console.log(req, 'FILE')
  const { username, formData } = req.body
  User.updateOne({ 'user_name': username }, { $set: { 'thumbnail': req.files.Files[0].filename } },
    // User.updateOne({ 'user_name': username }, { $set: { 'thumbnail': req.body.Files } },
    { upsert: true, multi: true },
    (err) => {
      res.status(200).send(req.files)
    })

});


app.listen(port, err => { // http://localhost:3001にサーバーがたつ
  if (err) throw new Error(err)
  else console.log(`listening on port ${port}`)
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