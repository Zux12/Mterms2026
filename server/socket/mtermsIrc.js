const MtermsIrcMessage =
  require('../models/MtermsIrcMessage');


const CHANNELS = [
  '#kampung',
  '#mamak',
  '#lagenda'
];


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


function setupMtermsIrc(io){

  /*
    Dedicated namespace.

    This keeps MTERMS32 isolated
    from any future socket features.
  */
  const irc =
    io.of('/mterms32');


  irc.on(
    'connection',
    socket => {

      /*
        Client tells us who they are
        after connection.
      */
      socket.on(
        'irc:identify',
        async payload => {

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
            Automatically join all three
            nostalgic channels.
          */
for(const channel of CHANNELS){

  socket.join(
    channel
  );


  const created =
    await MtermsIrcMessage.create({
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
            Return current nick lists.
          */
          await emitAllNickLists(
            irc
          );

        }
      );


      /*
        Client requests recent history
        for one channel.
      */
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
                  createdAt: -1
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


      /*
        New participant chat message.
      */
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


          }catch(error){

            console.error(
              'MTERMS32 message error:',
              error
            );

          }

        }
      );


      /*
        Client switches visible channel.

        They are already joined to all
        channels. This only helps us track
        what is currently active.
      */
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

      for(const channel of CHANNELS){

        try{

          const created =
            await MtermsIrcMessage.create({
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


    await emitAllNickLists(
      irc
    );

  }
);


    await emitAllNickLists(
      irc
    );

  }
);

    }
  );

}


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
      Because everybody automatically
      joins all three channels for this
      nostalgic version, the same active
      socket list is used for each room.

      The bots will be added later by
      the frontend/backend bot layer.
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
