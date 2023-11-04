1、老三样
dns先搞定

2、配置nginx

    sudo cp pwa-demo mm-server

    server {
        listen 80;
        server_name mm.lemonhall.me;
        # enforce https
        return 301 https://$server_name:443$request_uri;
    }
    server {
        listen 443 ssl http2;
        server_name mm.lemonhall.me;
        ssl_certificate /etc/letsencrypt/live/172-233-73-134.ip.linodeusercontent.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/172-233-73-134.ip.linodeusercontent.com/privkey.pem;
        location / {
            root /home/lemonhall/mm;
            index index.html;
            try_files $uri $uri/ =404;
        }
    }

3、重启nginx

sudo systemctl reload nginx

4、准备好文件

    index.html
    icons/512.png
    app.js
    manifest.json

好嘞，然后测试好了以后，开始写代码嘞

5、困扰了我许久的问题，禁止js缓存

    <script type="text/javascript">
      document.write("<script src='app.js?"+Math.random()+"'><\/script>");
    </script>

6、搞一个mqtt？

    sudo docker pull emqx/mqttx-web
    sudo docker run -d --name mqttx-web -p 8028:80 emqx/mqttx-web

7、再搞一个映射吧，那还咋整？

    server {
        listen 80;
        server_name mqttx.lemonhall.me;
        # enforce https
        return 301 https://$server_name:443$request_uri;
    }
    server {
        listen 443 ssl http2;
        server_name mqttx.lemonhall.me;
        ssl_certificate /etc/letsencrypt/live/172-233-73-134.ip.linodeusercontent.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/172-233-73-134.ip.linodeusercontent.com/privkey.pem;
        location / {
            proxy_pass http://127.0.0.1:8028/;
            proxy_set_header Host $host;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection upgrade;
            proxy_set_header Accept-Encoding gzip;
        }
    }

8、再次重启

    sudo systemctl reload nginx

9、然后dns有点问题，我为了强制开始所以写了hosts文件

    https://mqttx.lemonhall.me/#/help

10、引入MQTT.js

    https://www.emqx.com/zh/blog/mqtt-js-tutorial
    https://github.com/mqttjs/MQTT.js#install
    Via CDN
    The MQTT.js bundle is available through http://unpkg.com, specifically at https://unpkg.com/mqtt/dist/mqtt.min.js. See http://unpkg.com for the full documentation on version ranges.

    Be sure to only use this bundle with ws or wss URLs in the browser. Others URL types will likey fail

最后引入：

     <script src="mqtt.min.js"></script>


11、接受消息

    var client = mqtt.connect('wss://test.mosquitto.org:8081')

    client.subscribe("/")

    client.on("message", function (topic, payload) {
        console.log([topic, payload].join(": "))
    })

非常顺利得就接收成功了，很好

12、接下来是发送消息

    sendButton.addEventListener("touchstart", (event) => {
        console.log(userMsg.value);
        client.publish("/", userMsg.value);
        userMsg.value="";
    });

13、pgp可以开始入场了

    https://unpkg.com/browse/openpgp@5.11.0/dist/

    wget https://unpkg.com/openpgp@5.11.0/dist/openpgp.min.js

    <script src="openpgp.min.js"></script>

