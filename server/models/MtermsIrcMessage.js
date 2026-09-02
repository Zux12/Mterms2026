const mongoose = require('mongoose');

const MtermsIrcMessageSchema =
  new mongoose.Schema(
    {

      channel: {
        type: String,
        required: true,
        enum: [
          '#kampung',
          '#mamak',
          '#lagenda'
        ],
        index: true
      },

      messageType: {
        type: String,
        enum: [
          'chat',
          'join',
          'leave',
          'system',
          'bot'
        ],
        default: 'chat',
        index: true
      },

      nickname: {
        type: String,
        trim: true,
        maxlength: 50,
        default: ''
      },

      title: {
        type: String,
        trim: true,
        maxlength: 30,
        default: ''
      },

      affiliation: {
        type: String,
        trim: true,
        maxlength: 80,
        default: ''
      },

      participantId: {
        type: String,
        trim: true,
        maxlength: 200,
        default: '',
        index: true
      },

      message: {
        type: String,
        trim: true,
        maxlength: 500,
        required: true
      }

    },
    {
      timestamps: true,
      collection: 'mtermslive_irc_messages'
    }
  );


MtermsIrcMessageSchema.index({
  channel: 1,
  createdAt: -1
});


module.exports =
  mongoose.models.MtermsIrcMessage ||
  mongoose.model(
    'MtermsIrcMessage',
    MtermsIrcMessageSchema
  );
