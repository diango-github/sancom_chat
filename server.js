"use strict"; //厳格モードとする

//モジュール
const express = require("express");
const http = require("http");
const socketIO = require( "socket.io" );

//オブジェクト
const app = express();
const server = http.Server(app);
const io = socketIO( server );

//定数
const PORT = process.env.PORT || 1337;

//LocalとHeroku接続先によってPORTを切り替える
//let port = process.env.PORT;
//if (port == null || port == "") {
    //port = 3000;
//}


// 接続時の処理
// ・サーバーとクライアントの接続が確立すると、
// 　サーバー側で、"connection"イベント
// 　クライアント側で、"connect"イベントが発生する
io.on(
    "connection",
    ( socket ) =>
    {
        console.log( "connection : ", socket.id );

        // 切断時の処理
        // ・クライアントが切断したら、サーバー側では"disconnect"イベントが発生する
        socket.on(
            "disconnect",
            () =>
            {
                console.log( "disconnect : ", socket.id );
            } );

        // signalingデータ受信時の処理
        // ・クライアント側のsignalingデータ送信「socket.emit( "signaling", objData );」に対する処理
        socket.on(
            "signaling",
            ( objData ) =>
            {
                console.log( "signaling : ", socket.id );
                console.log( "- type : ", objData.type );

                // 指定の相手に送信
                if( "to" in objData )
                {
                    console.log( "- to : ", objData.to );
                    // 送信元SocketIDを送信データに付与し、指定の相手に送信
                    objData.from = socket.id;
                    socket.to( objData.to ).emit( "signaling", objData );
                }
                else
                {
                    //console.error( "Unexpected : Unknown destination" );　元々のコメント
                    //以下に翻訳機能を追加
                    console.log( "翻訳前の原文 : ", objData.data );
                    const projectId = 'sancom-project-2022';
                    const location  = 'us-central1'; // 現在は"global"か"us-central1"のみ
                    /*Herokuデプロイ時はコメントアウト*/
                    const TOKEN_ARG = 2;
                    const tokenPath = process.argv[TOKEN_ARG];
                    process.env.GOOGLE_APPLICATION_CREDENTIALS = tokenPath;
                    console.log( "tokenPath: ", tokenPath );
                    /*Herokuデプロイ時はコメントアウト*/
                    const {TranslationServiceClient} = require('@google-cloud/translate').v3;

                    // Instantiates a client
                    const translationClient = new TranslationServiceClient();
                    async function translate(text, sourceLang, targetLang) {
                        const req = {
                            parent: translationClient.locationPath(projectId, location),
                            contents: [text],
                            mimeType: 'text/plain', // mime types: text/plain, text/html
                            sourceLanguageCode: sourceLang,
                            targetLanguageCode: targetLang,
                        };
                        const res = await translationClient.translateText(req);
                        for (const elem of res) {
                            if (elem == null) {  // なぜかnullがレスポンスに含まれる
                                continue;
                            }
                            else {
                                return elem["translations"][0]["translatedText"];
                                //objData.data = elem["translations"][0]["translatedText"];
                                //console.log("objData: ", objData.data);
                                //objData.from = socket.id;
                                //socket.emit( "signaling", objData );                                
                            }
                        }
                    }
                    async function execute(text){
                        let targetTexts = [];
                        for (const targetLang of ["en-US", "zh-CN", "ko"]){
                            const targetText = await translate(text, "ja", targetLang);
                            targetTexts.push(targetText);
                        }
                        console.log("targetTexts: ", targetTexts);
                        objData.data = targetTexts;
                        objData.from = socket.id;
                        // 全員へ送信
                        socket.emit( "signaling", objData );
                    }
                    const text = objData.data
                    execute(text);
                }
            } );
        // ビデオチャット参加時の処理
        socket.on(
            "join",
            ( objData ) =>
            {
                console.log( "join : ", socket.id );

                // ルーム名
                let strRoomName = objData.roomname;
                if( !strRoomName )
                {
                    strRoomName = "**********NoName**********"
                }
                console.log( "- Room name = ", strRoomName );

                // ルームへの入室
                socket.join( strRoomName );
                // ルーム名をsocketオブジェクトのメンバーに追加
                socket.strRoomName = strRoomName;

                // 「join」を同じルームの送信元以外の全員に送信
                // 送信元SocketIDを送信データに付与し、同じルームの送信元以外の全員に送信
                socket.broadcast.to( strRoomName ).emit( "signaling", { from: socket.id, type: "join" } );
            } );

        // ビデオチャット離脱時の処理
        socket.on(
            "leave",
            ( objData ) =>
            {
                console.log( "leave : ", socket.id );
                
                if( "strRoomName" in socket )
                {
                    console.log( "- Room name = ", socket.strRoomName );

                    // ルームからの退室
                    socket.leave( socket.strRoomName );
                    // socketオブジェクトのルーム名のクリア
                    socket.strRoomName = "";
                }
            } );
    } );

//公開フォルダの指定
app.use( express.static( __dirname + "/public" ) );

//サーバーの起動
server.listen(
    PORT,
    () =>
    {
        console.log("Server on port %d", PORT );
    } );