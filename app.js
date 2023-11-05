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
        }else if(obj.userName != myUsrName && obj.type == "encrypted"){
            //这是别人发送的加密信息，查看本地有没有这个用户名所对应的公钥，如果有的话，那就是request过的，可以用自己的私钥解密的
            //如果没有的话，就需要提示自己这个用户需要request一下公钥
            var mmsg= "该消息已加密，你还未得到对方授权，所以看不到该消息，您可以申请对方对你的授权，但已加密信息因签发机制所限制，亦无法查看；"+
                      "<a href='#' ontouchstart=\"requestPublicKey(\'"+obj.userName+"\')\">点击向该用户申请密钥</a>"+
                      "</br>";
            outputArea.appendHTML([obj.userName, mmsg].join(": "));
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
            const encrypted = await openpgp.encrypt({
                message: await openpgp.createMessage({ text: userMsg.value }), // input as Message object
                encryptionKeys: myLocalKey.publicKey,
                signingKeys: myLocalKey.privateKey // optional
            });
            console.log(encrypted); // '-----BEGIN PGP MESSAGE ... END PGP MESSAGE-----'
            client.publish("/",JSON.stringify({userName:myUsrName,type:"encrypted",msg:encrypted}));
            userMsg.value="";
    })();
});