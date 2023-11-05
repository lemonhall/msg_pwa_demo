const doButton = document.getElementById("dododo");
const outputArea = document.getElementById("output");
const userMsg = document.getElementById("user_msg");
const sendButton = document.getElementById("send_msg");
const myUsrNameInput = document.getElementById("myUsrName");

//输出用的缓冲区
var outputHtml = "";
//存储key的对象，之后需要结合一下本地存储
var myLocalKey = {};
//初始化mqtt的客户端
var client = mqtt.connect('wss://test.mosquitto.org:8081');
//订阅的频道
client.subscribe("/");
//自己的用户名
var myUsrName = "";
//尝试从缓存中恢复本机的用户名
if(localStorage["myUsrName"]!=null){
    myUsrName=localStorage["myUsrName"];
    myUsrNameInput.value = myUsrName;
}else{

}
//尝试设置自己的用户名
myUsrNameInput.addEventListener("change", (event) => {
    myUsrName = myUsrNameInput.value;
    localStorage["myUsrName"] = myUsrName;
});

//尝试初始化publicKeysArmored，多公钥全局变量机制
//https://github.com/openpgpjs/openpgpjs/blob/main/README.md#encrypt-and-decrypt-string-data-with-pgp-keys
var PublicKeysArmoredString = [];
function constuctPublicKeysArmoredString(){
    console.log("开始进入到constuctPublicKeysArmoredString工作范围：")
    Object.keys(localStorage)
    .filter(x =>
        x.startsWith('othersPublicKey'))
    .forEach(x => 
        PublicKeysArmoredString.push(localStorage.getItem(x))
        //console.log(localStorage.getItem(x))
    )
    console.log("结束constuctPublicKeysArmoredString工作范围：");
    console.log("PublicKeysArmoredString");
}

//处理接收到的消息
client.on("message", function (topic, payload) {
    console.log([topic, payload].join(": "));
    var obj = JSON.parse(payload);
    if(obj.type != null){
        //如果是自己发送的消息，那就简单了，就用自己的密钥去解码就好了
        if(obj.userName == myUsrName && obj.type == "encrypted"){
                (async () => {
                    const message = await openpgp.readMessage({
                        armoredMessage: obj.msg // parse armored message
                    });
                    const { data: decrypted, signatures } = await openpgp.decrypt({
                        message,
                        verificationKeys: myLocalKey.publicKey, // optional
                        decryptionKeys: myLocalKey.privateKey
                    });
                    console.log(decrypted); // 'Hello, World!'
                    var mmsg= decrypted+"</br>";
                    outputArea.appendHTML([obj.userName, mmsg].join(": "));
                })();
        }else if(obj.userName == myUsrName && obj.type == "requestPublicKey"){
            //这是自己发送的给别人的要求需要公钥的信息，忽略就好了，不用管
        }else if(obj.userName != myUsrName && obj.type == "requestPublicKey" && obj.msg == myUsrName){
            //这是接收到了别人发送给我的需要公钥的请求了
            console.log("接收到了别人发送给我的需要公钥的请求了");
            var reqMsg = obj.userName+"请求获得我方的公钥，以加密对方的消息，供未来，与我方的通讯，是否同意？"
            console.log(reqMsg);
            if (confirm(reqMsg)) {
                // 同意
                console.log('同意获取公钥请求');
                //向公开频道上交换公钥信息，这个其实未来可以改进一下
                console.log('即将发送的公钥是：');
                console.log(myLocalKey["publicKeyArmored"]);
                client.publish("/",JSON.stringify({userName:myUsrName,type:"responePublicKey",msg:myLocalKey["publicKeyArmored"]}));
              } else {
                // 不同意，看是不是要返回一个no的信息
                console.log('公钥获取请求被用户驳回了');
              }
        }else if(obj.userName != myUsrName && obj.type == "responePublicKey"){
            //这是接受到了别人的公钥回应信息了，做响应的处理，首先存储到本地
            localStorage["othersPublicKey_"+obj.userName]=obj.msg;
            console.log("已缓存"+obj.userName+"公钥到我方本地存储，下一次消息加密，会纳入加密公钥范围;");
            //设置多keys全局变量，第一个变量当然是自己的公钥
            PublicKeysArmoredString.push(myLocalKey["publicKeyArmored"]);
            //然后把localStorage里所有的公钥都取出来，再concat上去,这里相当于是把这个变量重新构建一遍
            constuctPublicKeysArmoredString();
            console.log("新构建好的多keys的公钥群字符串是：");
            console.log(PublicKeysArmoredString);
        }else if(obj.userName != myUsrName && obj.type == "encrypted"){
            //这是别人发送的加密信息，查看本地有没有这个用户名所对应的公钥，如果有的话，那就是request过的，可以用自己的私钥解密的
            //如果没有的话，就需要提示自己这个用户需要request一下公钥
            if(localStorage["othersPublicKey_"+obj.userName]!=null){
                (async () => {
                    const message = await openpgp.readMessage({
                        armoredMessage: obj.msg // parse armored message
                    });
                    const { data: decrypted } = await openpgp.decrypt({
                        message,
                        decryptionKeys: myLocalKey.privateKey
                    });
                    console.log(decrypted); // 'Hello, World!'
                    var mmsg= decrypted+"</br>";
                    outputArea.appendHTML([obj.userName, mmsg].join(": "));
                })();
            }else{
                //如果我没有对方的公钥，那对方的消息我发送的时候肯定是没有带上的，那只能显示这个了
                var mmsg= "该消息已加密，你还未得到对方授权，所以看不到该消息，您可以申请对方对你的授权，但已加密信息因签发机制所限制，亦无法查看；"+
                        "<a href='#' ontouchstart=\"requestPublicKey(\'"+obj.userName+"\')\">点击向该用户申请密钥</a>"+
                        "</br>";
                outputArea.appendHTML([obj.userName, mmsg].join(": "));
            }
        }
    }
});

//向其它用户申请对方的公钥来加密消息
function requestPublicKey(name){
    console.log("I am going to requst public user :"+name);
    //向公开频道上索要公钥信息
    client.publish("/",JSON.stringify({userName:myUsrName,type:"requestPublicKey",msg:name}));
}


//给结果元素上append内容的辅助函数
//https://www.cnblogs.com/7qin/p/12117251.html
HTMLElement.prototype.appendHTML = function(html) {
    var divTemp = document.createElement("div"), nodes = null
        // 文档片段，一次性append，提高性能
        , fragment = document.createDocumentFragment();
    divTemp.innerHTML = html;
    nodes = divTemp.childNodes;
    for (var i=0, length=nodes.length; i<length; i+=1) {
       fragment.appendChild(nodes[i].cloneNode(true));
    }
    this.appendChild(fragment);
    // 据说下面这样子世界会更清净
    nodes = null;
    fragment = null;
};

//初始化opengpg
console.log(openpgp);

if(localStorage["myLocalKey"]!=null){
    myLocalKey=JSON.parse(localStorage["myLocalKey"]);
    (async () => {
        myLocalKey.publicKey = await openpgp.readKey({ armoredKey: myLocalKey.publicKeyArmored });
        myLocalKey.privateKey = await openpgp.readPrivateKey({ armoredKey: myLocalKey.privateKeyArmored });
        console.log("localStorage里反序列化之后的myLocalKey计算后的样子是：");
        console.log(myLocalKey);
    })();
    //设置多keys全局变量，第一个变量当然是自己的公钥
    PublicKeysArmoredString.push(myLocalKey["publicKeyArmored"]);
    //然后把localStorage里所有的公钥都取出来，再concat上去
    constuctPublicKeysArmoredString();
}else{
(async () => {
    const { privateKey, publicKey, revocationCertificate } = await openpgp.generateKey({
        type: 'ecc', // Type of the key, defaults to ECC
        curve: 'curve25519', // ECC curve name, defaults to curve25519
        userIDs: [{ name: 'Jon Smith', email: 'jon@example.com' }], // you can pass multiple user IDs
        format: 'armored' // output key format, defaults to 'armored' (other options: 'binary' or 'object')
    });

    console.log(privateKey);     // '-----BEGIN PGP PRIVATE KEY BLOCK ... '
    console.log(publicKey);      // '-----BEGIN PGP PUBLIC KEY BLOCK ... '
    console.log(revocationCertificate); // '-----BEGIN PGP PUBLIC KEY BLOCK ... '

    myLocalKey.privateKeyArmored=privateKey;
    myLocalKey.publicKeyArmored=publicKey;
    myLocalKey.revocationCertificateArmored=revocationCertificate;
    console.log("第一次生成key未计算之前的样子");
    console.log(myLocalKey);
    localStorage["myLocalKey"]=JSON.stringify(myLocalKey);

    PublicKeysArmoredString.push(publicKey);
    constuctPublicKeysArmoredString();

    myLocalKey.publicKey = await openpgp.readKey({ armoredKey: publicKey });
    myLocalKey.privateKey = await openpgp.readPrivateKey({ armoredKey: privateKey });
})();
}//初始化key结束


//清空按钮的处理过程
doButton.addEventListener("touchstart", (event) => {
    outputHtml = "";
    outputArea.innerHTML = "";
});

//发送按钮的处理过程
sendButton.addEventListener("touchstart", (event) => {
    console.log("发送按钮的处理过程");
    console.log(userMsg.value); 
    (async () => {
        const publicKeys = await Promise.all(PublicKeysArmoredString.map(armoredKey => openpgp.readKey({ armoredKey })));
        const message = await openpgp.createMessage({ text: userMsg.value });
        const encrypted = await openpgp.encrypt({
            message, // input as Message object
            encryptionKeys: publicKeys
        });
        console.log("加密后的信息:")
        console.log(encrypted); // '-----BEGIN PGP MESSAGE ... END PGP MESSAGE-----'
        client.publish("/",JSON.stringify({userName:myUsrName,type:"encrypted",msg:encrypted}));
        userMsg.value="";
    })();
});