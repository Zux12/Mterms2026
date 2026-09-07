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

/* =====================================================
   MTERMS32 VIRTUAL PERSONAS
===================================================== */

const VIRTUAL_PERSONAS = [

  /* ===================================================
     #KAMPUNG — MAIN CONFERENCE CHAT
  =================================================== */

  {
    nickname:'Amir',
    channels:['#kampung'],
    lines:[
      'morning semua',
      'ramai dah sampai ke?',
      'which session u guys going after this?',
      'programme today quite packed',
      'anyone dekat ballroom now?',
      'siapa first time MTERMS?',
      'baru sempat buka chat ni',
      'okay see u guys later'
    ]
  },

  {
    nickname:'Mei',
    channels:['#kampung','#lagenda'],
    lines:[
      'good morning everyone',
      'just checking the programme',
      'so many sessions today',
      'any recommendation for session later?',
      'I just saw the Moments page',
      'nice to meet everyone here'
    ]
  },

  {
    nickname:'Farah',
    channels:['#kampung'],
    lines:[
      'hai semua 😄',
      'ramai kat sini rupanya',
      'saya tengah tengok programme dulu',
      'siapa dekat registration area?',
      'jangan lupa share gambar dekat Moments',
      'okay jumpa kat session'
    ]
  },

  {
    nickname:'Priya',
    channels:['#kampung','#lagenda'],
    lines:[
      'hello everyone',
      'looking forward to the sessions today',
      'checking my schedule now',
      'there are many interesting topics',
      'anyone attending the next presentation?',
      'see you all later'
    ]
  },

  {
    nickname:'Aina',
    channels:['#kampung','#mamak'],
    lines:[
      'hello semua',
      'ambil gambar banyak banyak today 📸',
      'anyone dah tengok Moments?',
      'ramai juga pagi ni',
      'saya pergi session dulu',
      'enjoy conference semua'
    ]
  },

  {
    nickname:'Nabil',
    channels:['#kampung'],
    lines:[
      'first time MTERMS for me',
      'montage tadi nice',
      'just arrived at the venue',
      'checking which session to attend',
      'quite ramai today',
      'see everyone around'
    ]
  },

  {
    nickname:'Rachel',
    channels:['#kampung'],
    lines:[
      'morning everyone',
      'opening montage was nice',
      'already took some photos haha',
      'need to upload to Moments later',
      'trying to plan my sessions',
      'nice crowd today'
    ]
  },

  {
    nickname:'Iman',
    channels:['#kampung'],
    lines:[
      'morning guys',
      'ballroom area quite ramai now',
      'anyone still at registration?',
      'programme looks full today',
      'going into session now',
      'catch up later'
    ]
  },

  {
    nickname:'Joanne',
    channels:['#kampung','#lagenda'],
    lines:[
      'hello everyone',
      'remember speaker feedback guys',
      'checking programme now',
      'quite convenient having everything here',
      'anyone using My Schedule?',
      'see everyone later'
    ]
  },


  /* ===================================================
     #MAMAK — HOTEL / FOOD / CASUAL
  =================================================== */

  {
    nickname:'Hakim',
    channels:['#mamak'],
    lines:[
      'teh tarik mana teh tarik 😂',
      'dah penat ke belum semua',
      'nak cari coffee dulu',
      'siapa kat lobby?',
      'mamak channel mesti cerita makan',
      'okay sambung conference'
    ]
  },

  {
    nickname:'Kenny',
    channels:['#mamak','#lagenda'],
    lines:[
      'hello everybody',
      'today very busy haha',
      'I go find coffee first',
      'many people today',
      'okay I check schedule first',
      'see everybody later'
    ]
  },

  {
    nickname:'Shima',
    channels:['#mamak'],
    lines:[
      'anyone know Patio 1 which side?',
      'I am near lobby now',
      'parking tadi okay',
      'trying to find the room haha',
      'dah jumpa coffee',
      'okay found it'
    ]
  },

  {
    nickname:'Kumar',
    channels:['#mamak'],
    lines:[
      'concorde breakfast not bad actually',
      'anyone staying at the hotel?',
      'I need coffee again',
      'lobby quite busy now',
      'wonder what lunch is today',
      'good venue so far'
    ]
  },

  {
    nickname:'Azlan',
    channels:['#mamak'],
    lines:[
      'morning semua',
      'parking morning okay lagi',
      'I think Patio side dekat ballroom',
      'lobby ramai sekarang',
      'coffee dulu',
      'jalan jalan cari room'
    ]
  },

  {
    nickname:'Melissa',
    channels:['#mamak'],
    lines:[
      'aircond ballroom very cold 😂',
      'anyone brought jacket?',
      'already taking photos',
      'hotel lobby nice for photos actually',
      'waiting for coffee break',
      'need lunch soon haha'
    ]
  },

  {
    nickname:'Haziq',
    channels:['#mamak'],
    lines:[
      'coffee break bila 😂',
      'baru start dah lapar',
      'aircond memang kuat',
      'ramai dekat lobby',
      'conference survival = coffee',
      'okay masuk session balik'
    ]
  },

  {
    nickname:'Wei',
    channels:['#mamak'],
    lines:[
      'morning',
      'I only take coffee haha',
      'hotel okay so far',
      'very cold inside ballroom',
      'lunch later right?',
      'going back session now'
    ]
  },


  /* ===================================================
     #LAGENDA — IRC / TECH / NOSTALGIA
  =================================================== */

  {
    nickname:'Jason',
    channels:['#lagenda'],
    lines:[
      'seriously IRC in 2026 😂',
      'anyone here actually used mIRC before?',
      'this brings back memories',
      'old school but it works',
      'next somebody play dial up sound',
      'brb checking programme'
    ]
  },

  {
    nickname:'Daniel',
    channels:['#lagenda'],
    lines:[
      'I thought IRC disappeared 20 years ago',
      'who remembers ICQ also?',
      'this really feels old school',
      'status window brings back memories',
      'anyone remember ASL?',
      'technology really goes full circle'
    ]
  },

  {
    nickname:'Ravi',
    channels:['#lagenda'],
    lines:[
      'old technology inside new platform',
      'quite interesting concept actually',
      'programme and chat same place is convenient',
      'anyone used IRC in university days?',
      'this is unexpected for a conference',
      'digital conference has changed a lot'
    ]
  },

  {
    nickname:'Lina',
    channels:['#lagenda'],
    lines:[
      'what is ASL? 😂',
      'you all exposing your age now',
      'I never used IRC before this',
      'this is actually quite fun',
      'why does this look like Windows 98 haha',
      'okay now I understand the nostalgia'
    ]
  }

];


/* =====================================================
   MTERMS32 MINI CONVERSATIONS
===================================================== */

const PERSONA_CONVERSATIONS = {

  '#kampung':[

    [
      ['Nabil','montage tadi quite nice'],
      ['Rachel','yaa especially opening part'],
      ['Amir','very different for conference haha'],
      ['Mei','who made the video?'],
      ['Nabil','not sure but nice la']
    ],

    [
      ['Farah','ramai dah sampai?'],
      ['Iman','ballroom area quite ramai now'],
      ['Farah','okay coming down']
    ],

    [
      ['Aina','anyone taking photos today 📸'],
      ['Rachel','already haha'],
      ['Aina','put in Moments!'],
      ['Rachel','later later 😂']
    ],

    [
      ['Priya','so many parallel sessions today'],
      ['Amir','same problem haha'],
      ['Priya','I saved mine in My Schedule'],
      ['Joanne','good idea easier to check later']
    ],

    [
      ['Joanne','guys remember speaker feedback also'],
      ['Mei','where is it?'],
      ['Joanne','programme > open speaker > provide feedback'],
      ['Mei','found it 👍']
    ],

    [
      ['Iman','first time MTERMS for anyone?'],
      ['Nabil','me'],
      ['Rachel','second time for me'],
      ['Jason','first time using IRC at conference definitely 😂']
    ]

  ],


  '#mamak':[

    [
      ['Hakim','siapa dah breakfast'],
      ['Kumar','concorde breakfast not bad actually'],
      ['Wei','you staying here also?'],
      ['Kumar','yup just for conference'],
      ['Kenny','I only take coffee 😂']
    ],

    [
      ['Shima','anyone know Patio 1 which side?'],
      ['Azlan','I think near ballroom side'],
      ['Shima','okay jap I cari'],
      ['Azlan','follow sign after lobby'],
      ['Shima','found it thanks!']
    ],

    [
      ['Haziq','aircond ballroom cold or is it just me'],
      ['Melissa','VERY cold 😂'],
      ['Aina','luckily brought jacket'],
      ['Hakim','conference survival kit']
    ],

    [
      ['Kenny','coffee break when ah'],
      ['Wei','hahaha baru start already coffee'],
      ['Kenny','important question']
    ],

    [
      ['Melissa','parking tadi okay?'],
      ['Azlan','morning okay'],
      ['Hakim','later maybe full'],
      ['Melissa','luckily came early']
    ],

    [
      ['Farah','lunch sini ke?'],
      ['Kumar','should be conference lunch'],
      ['Kenny','finally serious discussion in mamak channel']
    ]

  ],


  '#lagenda':[

    [
      ['Jason','seriously IRC in 2026 😂'],
      ['Daniel','I thought this disappeared 20 years ago'],
      ['Mei','same haha'],
      ['Jason','next somebody play the dial up sound']
    ],

    [
      ['Ravi','anyone here actually used mIRC?'],
      ['Jason','yes unfortunately I am that old'],
      ['Lina','hahaha'],
      ['Daniel','ICQ also?'],
      ['Jason',"okay now you're going too far"]
    ],

    [
      ['Mei','funny that this works inside conference app'],
      ['Priya',"I didn't expect live chat when I scanned QR"],
      ['Ravi','programme + chat + feedback all same place'],
      ['Mei','quite convenient actually']
    ],

    [
      ['Kenny','last time need cyber cafe for this'],
      ['Jason','RM2 per hour 😂'],
      ['Lina','you all exposing your age now'],
      ['Kenny','delete this conversation please']
    ],

    [
      ['Daniel','who remembers ASL'],
      ['Jason','hahahaha'],
      ['Mei','what is ASL?'],
      ['Jason','okay you are definitely younger generation']
    ],

    [
      ['Ravi','old technology inside new platform'],
      ['Priya','actually nice concept'],
      ['Joanne','nostalgia with QR code 😂'],
      ['Jason','full circle']
    ]

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

/* =====================================================
   VIRTUAL PERSONA MESSAGE
===================================================== */

async function sendPersonaMessage(
  namespace,
  channel
){

  try{

    const available =
      VIRTUAL_PERSONAS
        .filter(
          persona =>
            persona.channels.includes(
              channel
            )
        );


    if(
      !available.length
    ){
      return;
    }


    const persona =
      available[
        Math.floor(
          Math.random() *
          available.length
        )
      ];


    const line =
      persona.lines[
        Math.floor(
          Math.random() *
          persona.lines.length
        )
      ];


    const created =
      await MtermsIrcMessage
        .create({

          channel,

          messageType:
            'chat',

          nickname:
            persona.nickname,

          title:
            'MTERMS32 Virtual Persona',

          affiliation:
            'MTERMS 2026 Digital Demonstration',

          participantId:
            'VIRTUAL_PERSONA:' +
            persona.nickname,

          message:
            line

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
      'MTERMS32 virtual persona error:',
      error
    );

  }

}

/* =====================================================
   PLAY VIRTUAL PERSONA CONVERSATION
===================================================== */

async function playPersonaConversation(
  namespace,
  channel
){

  const conversations =
    PERSONA_CONVERSATIONS[
      channel
    ] || [];


  if(
    !conversations.length
  ){
    return;
  }


  const conversation =
    conversations[
      Math.floor(
        Math.random() *
        conversations.length
      )
    ];


  let delay =
    0;


  conversation.forEach(
    (
      [
        nickname,
        message
      ],
      index
    ) => {

      /*
        First line appears fairly quickly.

        Following replies have natural
        2.5–6 second gaps.
      */

      if(
        index === 0
      ){

        delay =
          1000 +
          Math.floor(
            Math.random() *
            2000
          );

      }else{

        delay +=
          2500 +
          Math.floor(
            Math.random() *
            3500
          );

      }


      setTimeout(
        async ()=>{

          try{

            const created =
              await MtermsIrcMessage
                .create({

                  channel,

                  messageType:
                    'chat',

                  nickname,

                  title:
                    'MTERMS32 Virtual Persona',

                  affiliation:
                    'MTERMS 2026 Digital Demonstration',

                  participantId:
                    'VIRTUAL_PERSONA:' +
                    nickname,

                  message

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
              'MTERMS32 persona conversation error:',
              error
            );

          }

        },
        delay
      );

    }
  );

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

/* =====================================================
   VIRTUAL PERSONA BACKGROUND CHAT
===================================================== */

function scheduleVirtualPersona(){

  /*
    One message approximately every
    45–90 seconds.
  */

  const delay =
    45000 +
    Math.floor(
      Math.random() *
      45000
    );


  setTimeout(
    async ()=>{

      try{

        const sockets =
          await irc.fetchSockets();


        /*
          Only generate persona conversation
          while at least one real participant
          is connected.
        */

        const realUsers =
          sockets.filter(
            socket =>
              socket.data.nickname
          );


        if(
          realUsers.length > 0
        ){

          const channel =
            CHANNELS[
              Math.floor(
                Math.random() *
                CHANNELS.length
              )
            ];


          await sendPersonaMessage(
            irc,
            channel
          );

        }


      }catch(error){

        console.error(
          'MTERMS32 virtual persona scheduler error:',
          error
        );

      }


      scheduleVirtualPersona();

    },
    delay
  );

}


scheduleVirtualPersona();

/* =====================================================
   MINI CONVERSATION SCHEDULER
===================================================== */

function schedulePersonaConversation(){

  /*
    Start a mini conversation approximately
    every 4–7 minutes.

    Random single-person chatter continues
    independently every 45–90 seconds.
  */

  const delay =
    240000 +
    Math.floor(
      Math.random() *
      180000
    );


  setTimeout(
    async ()=>{

      try{

        const sockets =
          await irc.fetchSockets();


        const realUsers =
          sockets.filter(
            socket =>
              socket.data.nickname
          );


        if(
          realUsers.length > 0
        ){

          const channel =
            CHANNELS[
              Math.floor(
                Math.random() *
                CHANNELS.length
              )
            ];


          playPersonaConversation(
            irc,
            channel
          );

        }


      }catch(error){

        console.error(
          'MTERMS32 persona conversation scheduler error:',
          error
        );

      }


      schedulePersonaConversation();

    },
    delay
  );

}


schedulePersonaConversation();  
  
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
  Add virtual personas to the visible
  MTERMS32 nick list.

  Real connected users above remain untouched.
*/



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

    /*
      Start with the genuinely connected
      participants.
    */

    const channelNicknames =
      [
        ...nicknames
      ];


    /*
      Add only personas assigned
      to THIS particular room.
    */

    VIRTUAL_PERSONAS
      .filter(
        persona =>
          persona.channels.includes(
            channel
          )
      )
      .forEach(
        persona => {

          channelNicknames.push({

            nickname:
              persona.nickname,

            title:
              'MTERMS32 Virtual Persona',

            affiliation:
              'MTERMS 2026 Digital Demonstration'

          });

        }
      );


    namespace.emit(
      'irc:nicks',
      {
        channel,

        nicknames:
          channelNicknames
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
