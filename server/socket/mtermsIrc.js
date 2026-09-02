const MtermsIrcMessage =
  require('../models/MtermsIrcMessage');


const CHANNELS = [
  '#kampung',
  '#mamak',
  '#lagenda'
];
const BOTS = {

  '#kampung':[
    {
      nickname:'@KgBot',

      lines:[
        'selamat datang. buat macam rumah sendiri.',
        'sunyi betul kejap ni.',
        'ramai tengah conference agaknya.',
        'jangan lupa sesi seterusnya.',
        'kopi dah sampai ke belum?',
        'siapa lambat masuk tadi?',
        'hari ni ramai orang nampaknya.',
        'lama tak nampak chat macam ni.',
        'sembang boleh, programme jangan lupa.',
        'ada orang masih ingat IRC rupanya.',
        'testing testing... masih hidup.',
        'semua senyap tiba-tiba.',
        'rehat kejap sebelum sambung.',
        'conference mode masih ON.',
        'ramai lurker hari ni.'
      ]
    },

    {
      nickname:'@PakGuard',

      lines:[
        'selamat datang.',
        'semua okay kat sini.',
        'jalan terus, jangan malu-malu.',
        'saya tengok saja dari tadi.',
        'ramai masuk keluar hari ni.',
        'pintu masih buka.',
        'jaga barang masing-masing.',
        'siapa terakhir keluar tutup lampu.',
        'keadaan terkawal.',
        'sambung sembang.',
        'saya ronda dulu.',
        'tak ada apa-apa report setakat ni.',
        'ramai juga orang lama muncul balik.',
        'baik, semua masih ada.',
        'carry on.'
      ]
    }
  ],


  '#mamak':[
    {
      nickname:'@MamakBot',

      lines:[
        'teh tarik satu?',
        'order dulu, sembang kemudian.',
        'meja belakang masih kosong.',
        'kopi O pun ada.',
        'rehat conference kejap.',
        'siapa belum makan?',
        'teh tarik virtual sahaja hari ni.',
        'mamak masih buka.',
        'air dah sampai.',
        'jangan lupa makan.',
        'satu lagi teh tarik?',
        'ramai lepak sini nampaknya.',
        'order jangan tinggal.',
        'makan dulu baru sambung.',
        'hari panjang lagi.'
      ]
    },

    {
      nickname:'@Tauke',

      lines:[
        'boss, biasa?',
        'duduk dulu.',
        'apa cerita hari ni?',
        'ramai customer malam ni.',
        'meja hujung kosong.',
        'boleh tambah satu lagi.',
        'lama tak nampak.',
        'conference habis pukul berapa?',
        'okay boss.',
        'ambil masa, jangan rushing.',
        'semua settle.',
        'air panas lagi.',
        'boss datang balik rupanya.',
        'hari ni busy sikit.',
        'boleh boleh.'
      ]
    }
  ],


  '#lagenda':[
    {
      nickname:'@Lagenda',

      lines:[
        'some things are worth remembering.',
        'lama betul tak nampak suasana macam ni.',
        'IRC never really disappears.',
        'old habits return quickly.',
        'nama channel pun dah nostalgia.',
        'welcome back.',
        'macam pernah tengok tempat ni dulu.',
        'masa berubah, nickname masih ada.',
        'somewhere a modem is still connecting.',
        'simple times.',
        'tak sangka jumpa balik.',
        'this feels familiar.',
        'old school still works.',
        'memories loading...',
        'kita pernah buat benda ni setiap malam.'
      ]
    },

    {
      nickname:'@OldTimer',

      lines:[
        'dulu tunggu connection pun satu pengalaman.',
        'siapa ingat dial-up?',
        'nickname lama masih ingat?',
        'zaman sebelum social media.',
        'dulu channel penuh sampai pagi.',
        'lag pun kita tunggu.',
        'disconnect, connect balik.',
        'siapa pernah kena netsplit?',
        'masa tu 56k dah rasa laju.',
        'mIRC buka dulu, baru buat benda lain.',
        'join channel, duduk diam.',
        'lama sebelum group chat.',
        'bunyi modem masih boleh ingat.',
        'status window dulu wajib tengok.',
        'zaman lain.'
      ]
    }
  ]

};

function cleanString(
  value,
  maxLength
){

  return String(
    value || ''
  )
    .trim()
    .slice(
      0,
      maxLength
    );

}

async function sendBotMessage(
  namespace,
  channel
){

  try{

    const bots =
      BOTS[channel] || [];


    if(!bots.length){
      return;
    }


    const bot =
      bots[
        Math.floor(
          Math.random() *
          bots.length
        )
      ];


    const line =
      bot.lines[
        Math.floor(
          Math.random() *
          bot.lines.length
        )
      ];


    const created =
      await MtermsIrcMessage
        .create({

          channel,

          messageType:'bot',

          nickname:
            bot.nickname,

          title:'',

          affiliation:'MTERMSnet',

          participantId:'BOT',

          message:line

        });


    namespace
      .to(channel)
      .emit(
        'irc:message',
        serializeMessage(
          created
        )
      );


  }catch(error){

    console.error(
      'MTERMS32 bot error:',
      error
    );

  }

}

function setupMtermsIrc(io){

  /*
    Dedicated namespace for MTERMS32.
    Core MTERMS LIVE functions remain separate.
  */
  const irc =
    io.of('/mterms32');


  irc.on(
    'connection',
    socket => {


      /* =====================================================
         IDENTIFY
      ===================================================== */

      socket.on(
        'irc:identify',
        async payload => {

          try{

            const nickname =
              cleanString(
                payload?.nickname,
                50
              );

            const title =
              cleanString(
                payload?.title,
                30
              );

            const affiliation =
              cleanString(
                payload?.affiliation,
                80
              );

            const participantId =
              cleanString(
                payload?.participantId,
                200
              );


            if(
              !nickname ||
              !participantId
            ){
              return;
            }


            socket.data.nickname =
              nickname;

            socket.data.title =
              title;

            socket.data.affiliation =
              affiliation;

            socket.data.participantId =
              participantId;


            /*
              Automatically join all
              three nostalgic channels.
            */
            for(
              const channel
              of CHANNELS
            ){

              socket.join(
                channel
              );


              /*
                Save join notice into MongoDB
                so it remains in channel history.
              */
              const created =
                await MtermsIrcMessage
                  .create({
                    channel,
                    messageType:'join',
                    nickname,
                    title,
                    affiliation,
                    participantId,
                    message:
                      nickname +
                      ' has joined ' +
                      channel
                  });


              /*
                Everyone except the joining
                participant sees the notice.
              */
              socket
                .to(channel)
                .emit(
                  'irc:presence',
                  serializeMessage(
                    created
                  )
                );

            }


            /*
              Update nick lists after joining.
            */
            await emitAllNickLists(
              irc
            );

            /*
  Occasionally one room bot notices
  somebody arriving.

  Not every join receives a response.
*/
for(
  const channel
  of CHANNELS
){

  if(
    Math.random() < 0.30
  ){

    const delay =
      1200 +
      Math.floor(
        Math.random() *
        3000
      );


    setTimeout(
      ()=>{

        sendBotMessage(
          irc,
          channel
        );

      },
      delay
    );

  }

}

          }catch(error){

            console.error(
              'MTERMS32 identify error:',
              error
            );

          }

        }
      );


      /* =====================================================
         HISTORY
      ===================================================== */

      socket.on(
        'irc:history',
        async payload => {

          try{

            const channel =
              cleanString(
                payload?.channel,
                40
              );


            if(
              !CHANNELS.includes(
                channel
              )
            ){
              return;
            }


            const messages =
              await MtermsIrcMessage
                .find({
                  channel
                })
                .sort({
                  createdAt:-1
                })
                .limit(100)
                .lean();


            socket.emit(
              'irc:history',
              {
                channel,

                messages:
                  messages
                    .reverse()
                    .map(
                      serializeMessage
                    )
              }
            );


          }catch(error){

            console.error(
              'MTERMS32 history error:',
              error
            );

          }

        }
      );


      /* =====================================================
         CHAT MESSAGE
      ===================================================== */

      socket.on(
        'irc:message',
        async payload => {

          try{

            const channel =
              cleanString(
                payload?.channel,
                40
              );

            const message =
              cleanString(
                payload?.message,
                500
              );


            if(
              !CHANNELS.includes(
                channel
              ) ||
              !message ||
              !socket.data.nickname
            ){
              return;
            }


            const created =
              await MtermsIrcMessage
                .create({
                  channel,

                  messageType:
                    'chat',

                  nickname:
                    socket.data.nickname,

                  title:
                    socket.data.title || '',

                  affiliation:
                    socket.data.affiliation || '',

                  participantId:
                    socket.data.participantId || '',

                  message
                });


            irc
              .to(channel)
              .emit(
                'irc:message',
                serializeMessage(
                  created
                )
              );

            /*
  Occasionally let one resident bot
  respond after human conversation.

  22% chance.
*/
if(
  Math.random() < 0.22
){

  const delay =
    1800 +
    Math.floor(
      Math.random() *
      4200
    );


  setTimeout(
    ()=>{

      sendBotMessage(
        irc,
        channel
      );

    },
    delay
  );

}

          }catch(error){

            console.error(
              'MTERMS32 message error:',
              error
            );

          }

        }
      );


      /* =====================================================
         ACTIVE CHANNEL
      ===================================================== */

      socket.on(
        'irc:active-channel',
        payload => {

          const channel =
            cleanString(
              payload?.channel,
              40
            );


          if(
            CHANNELS.includes(
              channel
            )
          ){

            socket.data.activeChannel =
              channel;

          }

        }
      );


      /* =====================================================
         DISCONNECT / QUIT
      ===================================================== */

      socket.on(
        'disconnect',
        async ()=>{

          const nickname =
            socket.data.nickname;

          const title =
            socket.data.title || '';

          const affiliation =
            socket.data.affiliation || '';

          const participantId =
            socket.data.participantId || '';


          if(nickname){

            for(
              const channel
              of CHANNELS
            ){

              try{

                /*
                  Save quit notice into MongoDB
                  so it remains in history.
                */
                const created =
                  await MtermsIrcMessage
                    .create({
                      channel,
                      messageType:'leave',
                      nickname,
                      title,
                      affiliation,
                      participantId,
                      message:
                        nickname +
                        ' has quit IRC'
                    });


                socket
                  .to(channel)
                  .emit(
                    'irc:presence',
                    serializeMessage(
                      created
                    )
                  );


              }catch(error){

                console.error(
                  'MTERMS32 quit notice error:',
                  error
                );

              }

            }

          }


          /*
            Remove disconnected participant
            from the nick lists.
          */
          await emitAllNickLists(
            irc
          );

        }
      );


    }
  );


/*
  Occasional background bot chatter.

  One channel is selected approximately
  every 2–4 minutes.

  This timer belongs only to MTERMS32.
*/
function scheduleBackgroundBot(){

  const delay =
    120000 +
    Math.floor(
      Math.random() *
      120000
    );


  setTimeout(
    async ()=>{

      try{

        const sockets =
          await irc
            .fetchSockets();


        /*
          Don't create fake chatter when
          nobody is connected to MTERMS32.
        */
        if(
          sockets.length > 0
        ){

          const channel =
            CHANNELS[
              Math.floor(
                Math.random() *
                CHANNELS.length
              )
            ];


          await sendBotMessage(
            irc,
            channel
          );

        }


      }catch(error){

        console.error(
          'MTERMS32 background bot error:',
          error
        );

      }


      scheduleBackgroundBot();

    },
    delay
  );

}


scheduleBackgroundBot();
  
}


/* =====================================================
   SERIALIZE MESSAGE
===================================================== */

function serializeMessage(
  item
){

  return {

    id:
      String(
        item._id
      ),

    channel:
      item.channel,

    messageType:
      item.messageType,

    nickname:
      item.nickname || '',

    title:
      item.title || '',

    affiliation:
      item.affiliation || '',

    message:
      item.message || '',

    createdAt:
      item.createdAt

  };

}


/* =====================================================
   NICK LISTS
===================================================== */

async function emitAllNickLists(
  namespace
){

  try{

    const sockets =
      await namespace
        .fetchSockets();


    const nicknames = [];


    sockets.forEach(
      socket => {

        if(
          socket.data.nickname
        ){

          nicknames.push({
            nickname:
              socket.data.nickname,

            title:
              socket.data.title || '',

            affiliation:
              socket.data.affiliation || ''
          });

        }

      }
    );


    /*
      Everyone automatically joins all
      three channels, so the same active
      participant list currently appears
      in each channel.

      Bots are added separately by the
      MTERMS32 interface.
    */
    CHANNELS.forEach(
      channel => {

        namespace.emit(
          'irc:nicks',
          {
            channel,
            nicknames
          }
        );

      }
    );


  }catch(error){

    console.error(
      'MTERMS32 nick list error:',
      error
    );

  }

}


module.exports = {
  setupMtermsIrc
};
