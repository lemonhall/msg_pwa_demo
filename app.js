const doButton = document.getElementById("dododo");
const outputArea = document.getElementById("output");
const userMsg = document.getElementById("user_msg");
const sendButton = document.getElementById("send_msg");

var outputHtml = "";
var myLocalKey = {};

var client = mqtt.connect('wss://test.mosquitto.org:8081');

client.subscribe("/");

client.on("message", function (topic, payload) {
    console.log([topic, payload].join(": "));
    outputArea.appendHTML(payload+"</br>");
});

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

console.log(openpgp);

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

    myLocalKey.publicKey = await openpgp.readKey({ armoredKey: publicKey });
    myLocalKey.privateKey = await openpgp.readPrivateKey({ armoredKey: privateKey });

})();


doButton.addEventListener("touchstart", (event) => {
    outputHtml = "";
    outputArea.innerHTML = "";
});

sendButton.addEventListener("touchstart", (event) => {
    console.log(userMsg.value); 
    (async () => {
            const encrypted = await openpgp.encrypt({
                message: await openpgp.createMessage({ text: userMsg.value }), // input as Message object
                encryptionKeys: myLocalKey.publicKey,
                signingKeys: myLocalKey.privateKey // optional
            });
            console.log(encrypted); // '-----BEGIN PGP MESSAGE ... END PGP MESSAGE-----'
            client.publish("/",JSON.stringify({userName:"lemonhall",msg:encrypted}));
            userMsg.value="";
    })();
});

