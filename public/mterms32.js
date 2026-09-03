(function(){

"use strict";


/* =========================================================
   CONFIGURATION
========================================================= */

const M32_SERVER =
  "https://mterm2026-559f9bf571b5.herokuapp.com";

const CHANNELS = {
  "#kampung":{
    topic:
      "Sembang santai, kenal-kenal dan jangan lupa sesi seterusnya."
  },

  "#mamak":{
    topic:
      "Teh tarik, cerita conference dan sembang sementara ada masa."
  },

  "#lagenda":{
    topic:
      "Old-school IRC is back. Some things are worth remembering."
  }
};


const BOT_NICKS = {

  "#kampung":[
    "@KgBot",
    "@PakGuard"
  ],

  "#mamak":[
    "@MamakBot",
    "@Tauke"
  ],

  "#lagenda":[
    "@Lagenda",
    "@OldTimer"
  ]

};


const STORAGE = {
  lastChannel:
    "mterms32LastChannelV1"
};


const PROFILE_KEY =
  "mtermsLiveProfileV1";

const PARTICIPANT_ID_KEY =
  "mtermsLiveParticipantIdV1";


/* =========================================================
   STATE
========================================================= */

let socket = null;

let opened = false;
let minimized = false;
let maximized = false;
   let sessionStarted = false;

let activeTab =
  localStorage.getItem(
    STORAGE.lastChannel
  ) || "#kampung";

let channelMessages = {
  "#kampung":[],
  "#mamak":[],
  "#lagenda":[]
};

let statusLines = [];

let channelNicks = {
  "#kampung":[],
  "#mamak":[],
  "#lagenda":[]
};

const activityTabs =
  new Set();


/* =========================================================
   BASIC HELPERS
========================================================= */

function escapeHTML(value){

  return String(
    value ?? ""
  )
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");

}


function getProfile(){

  try{

    return JSON.parse(
      localStorage.getItem(
        PROFILE_KEY
      )
    ) || null;

  }catch{

    return null;

  }

}


function getParticipantId(){

  return (
    localStorage.getItem(
      PARTICIPANT_ID_KEY
    ) || ""
  );

}


function profileNick(){

  const profile =
    getProfile();

  return profile?.name ||
    "Guest";

}


function randomLag(){

  return (
    0.02 +
    Math.random() * 0.14
  ).toFixed(2);

}


/* =========================================================
   BUILD UI
========================================================= */

function buildMterms32(){

  if(
    document.getElementById(
      "m32-root"
    )
  ){
    return;
  }


  const root =
    document.createElement(
      "div"
    );

  root.id =
    "m32-root";


  root.innerHTML = `

    <button
      id="m32-launcher"
      type="button"
      aria-label="Open MTERMS32"
      title="MTERMS32"
    >
<span class="m32-launch-icon">
  <img
    src="/public/mirc2.png"
    alt="MTERMS32"
  >
</span>
    </button>


    <div
      id="m32-window"
      class="m32-hidden"
    >

      <div class="m32-titlebar">

<div class="m32-title-icon">
  <img
    src="/public/mirc2.png"
    alt=""
  >
</div>

        <div
          class="m32-title-text"
          id="m32-title-text"
        >
          MTERMS32
        </div>


        <div class="m32-window-buttons">

          <button
            class="m32-win-btn"
            id="m32-minimize"
            type="button"
            title="Minimize"
          >
            _
          </button>

          <button
            class="m32-win-btn"
            id="m32-maximize"
            type="button"
            title="Maximize / Restore"
          >
            □
          </button>

          <button
            class="m32-win-btn"
            id="m32-close"
            type="button"
            title="Close"
          >
            ×
          </button>

        </div>

      </div>


      <div class="m32-menu">

        <button
          class="m32-menu-item"
          type="button"
          data-m32-menu="file"
        >
          File
        </button>

        <button
          class="m32-menu-item"
          type="button"
          data-m32-menu="view"
        >
          View
        </button>

        <button
          class="m32-menu-item"
          type="button"
          data-m32-menu="favorites"
        >
          Favorites
        </button>

        <button
          class="m32-menu-item"
          type="button"
          data-m32-menu="tools"
        >
          Tools
        </button>

        <button
          class="m32-menu-item"
          type="button"
          data-m32-menu="commands"
        >
          Commands
        </button>

        <button
          class="m32-menu-item"
          type="button"
          data-m32-menu="window"
        >
          Window
        </button>

        <button
          class="m32-menu-item"
          type="button"
          data-m32-menu="help"
        >
          Help
        </button>

      </div>


      <div class="m32-toolbar">

        <button
          class="m32-tool"
          type="button"
          title="Connect"
        >
          ⚡
        </button>

        <button
          class="m32-tool"
          type="button"
          title="Channels"
        >
          #
        </button>

        <button
          class="m32-tool"
          type="button"
          title="People"
        >
          ☺
        </button>

        <span class="m32-tool-separator"></span>

        <button
          class="m32-tool"
          type="button"
          title="Favorites"
        >
          ★
        </button>

        <button
          class="m32-tool"
          type="button"
          title="Options"
        >
          ⚙
        </button>

      </div>


      <div class="m32-tabs">

        <button
          class="m32-tab"
          type="button"
          data-m32-tab="status"
        >
          Status
        </button>

        <button
          class="m32-tab"
          type="button"
          data-m32-tab="#kampung"
        >
          #kampung
        </button>

        <button
          class="m32-tab"
          type="button"
          data-m32-tab="#mamak"
        >
          #mamak
        </button>

        <button
          class="m32-tab"
          type="button"
          data-m32-tab="#lagenda"
        >
          #lagenda
        </button>

      </div>


      <div
        class="m32-child-title"
        id="m32-child-title"
      >
        Status
      </div>


      <div class="m32-body">

        <div class="m32-chat-pane">

          <div
            class="m32-chat-scroll"
            id="m32-chat-scroll"
          ></div>

        </div>


        <div
          class="m32-nicks"
          id="m32-nicks"
        ></div>

      </div>


      <div
        class="m32-inputbar"
        id="m32-inputbar"
      >

        <input
          id="m32-input"
          type="text"
          maxlength="500"
          autocomplete="off"
          placeholder=""
        >

        <button
          id="m32-send"
          type="button"
        >
          Send
        </button>

      </div>


      <div class="m32-statusbar">

        <div
          class="m32-status-cell"
          id="m32-status-user"
        >
          Guest [+i]
        </div>

        <div
          class="m32-status-cell"
          id="m32-status-channel"
        >
          Status
        </div>

        <div
          class="m32-status-cell"
          id="m32-status-users"
        >
          0 users
        </div>

        <div
          class="m32-status-cell"
        >
          MTERMSnet
        </div>

        <div
          class="m32-status-cell"
          id="m32-status-lag"
        >
          Lag: 0.04
        </div>

      </div>


      <div
        class="
          m32-dialog-backdrop
          m32-hidden
        "
        id="m32-welcome"
      >

        <div class="m32-dialog">

          <div class="m32-dialog-title">
            MTERMS32
          </div>

          <div class="m32-dialog-content">

            <strong>
              Welcome back.
            </strong>

            <br><br>

            It's been a while.

          </div>

          <div class="m32-dialog-actions">

            <button
              class="m32-dialog-button"
              id="m32-welcome-ok"
              type="button"
            >
              OK
            </button>

          </div>

        </div>

      </div>


      <div
        class="
          m32-dialog-backdrop
          m32-hidden
        "
        id="m32-about"
      >

        <div class="m32-dialog">

          <div class="m32-dialog-title">
            About MTERMS32
          </div>

<div class="m32-dialog-content">

  <div
    style="
      text-align:center;
      line-height:1.45;
    "
  >

    <strong
      style="
        font-size:16px;
      "
    >
      MTERMS32
    </strong>

    <br>

    Internet Relay Chat — Conference Edition

    <br>

    Version 1.0

    <br><br>

    Part of the
    <strong>MTERMS 2026 Digital Platform</strong>

    <br><br>

    Developed by

    <br>

    <strong>
      IgniteInno Ventures Sdn Bhd
    </strong>

    <br>

    MTERMS 2026 Digital Platform Provider

    <br><br>

    <span
      style="
        font-size:10px;
      "
    >
      Copyright © 2026
      IgniteInno Ventures Sdn Bhd

      <br>

      All Rights Reserved.
    </span>

  </div>

</div>

          <div class="m32-dialog-actions">

            <button
              class="m32-dialog-button"
              id="m32-about-ok"
              type="button"
            >
              OK
            </button>

          </div>

        </div>

      </div>

    </div>

  `;


  document.body.appendChild(
    root
  );


  bindInterface();

  updateStatusBar();

}


/* =========================================================
   INTERFACE EVENTS
========================================================= */

function bindInterface(){

  document
    .getElementById(
      "m32-launcher"
    )
    .addEventListener(
      "click",
      openMterms32
    );


  document
    .getElementById(
      "m32-minimize"
    )
    .addEventListener(
      "click",
      minimizeMterms32
    );


  document
    .getElementById(
      "m32-maximize"
    )
    .addEventListener(
      "click",
      toggleMaximize
    );


  document
    .getElementById(
      "m32-close"
    )
    .addEventListener(
      "click",
      closeMterms32
    );


  document
    .querySelectorAll(
      "[data-m32-tab]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        ()=>{

          switchTab(
            button.dataset.m32Tab
          );

        }
      );

    });


  document
    .getElementById(
      "m32-send"
    )
    .addEventListener(
      "click",
      sendMessage
    );


  document
    .getElementById(
      "m32-input"
    )
    .addEventListener(
      "keydown",
      event => {

        if(
          event.key === "Enter"
        ){

          event.preventDefault();

          sendMessage();

        }

      }
    );


 document
  .getElementById(
    "m32-welcome-ok"
  )
  .addEventListener(
    "click",
    ()=>{

      document
        .getElementById(
          "m32-welcome"
        )
        .classList
        .add("m32-hidden");


      sessionStarted = true;

      runConnectionSequence();

    }
  );

  document
    .getElementById(
      "m32-about-ok"
    )
    .addEventListener(
      "click",
      ()=>{

        document
          .getElementById(
            "m32-about"
          )
          .classList
          .add("m32-hidden");

      }
    );


  document
    .querySelectorAll(
      "[data-m32-menu]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        ()=>{

          /*
            For now only Help has a
            deliberately functional menu.
          */

          if(
            button.dataset.m32Menu ===
            "help"
          ){

            document
              .getElementById(
                "m32-about"
              )
              .classList
              .remove("m32-hidden");

          }

        }
      );

    });

}


/* =========================================================
   OPEN / MINIMIZE / MAXIMIZE / CLOSE
========================================================= */

function openMterms32(){

  const profile =
    getProfile();


  /*
    MTERMS32 uses the existing
    MTERMS LIVE nickname/profile.
  */
  if(
    !profile ||
    !profile.name
  ){

    alert(
      "Please create your MTERMS LIVE profile first."
    );

    return;

  }


  const win =
    document.getElementById(
      "m32-window"
    );


  win.classList.remove(
    "m32-hidden"
  );


  document
    .getElementById(
      "m32-launcher"
    )
    .classList
    .remove("m32-activity");


  opened = true;
  minimized = false;


  if(
    !socket ||
    !socket.connected
  ){

    connectSocket();

  }


/*
  A new MTERMS32 session shows
  the nostalgic welcome dialog.

  Restoring from Minimize does not.
*/
if(!sessionStarted){

  switchTab("status");

  document
    .getElementById(
      "m32-welcome"
    )
    .classList
    .remove("m32-hidden");

}else{

  switchTab(
    activeTab
  );

}
}


function minimizeMterms32(){

  document
    .getElementById(
      "m32-window"
    )
    .classList
    .add("m32-hidden");


  minimized = true;
  opened = false;


  /*
    DO NOT disconnect.

    MTERMS32 continues running
    in the background.
  */

}


function toggleMaximize(){

  const win =
    document.getElementById(
      "m32-window"
    );


  maximized =
    !maximized;


  win.classList.toggle(
    "m32-maximized",
    maximized
  );

}


function closeMterms32(){

  document
    .getElementById(
      "m32-window"
    )
    .classList
    .add("m32-hidden");


  opened = false;
  minimized = false;
   sessionStarted = false;


  /*
    Close means disconnect.
    Minimize does not.
  */
  if(socket){

    socket.disconnect();

    socket = null;

  }

}


/* =========================================================
   SOCKET
========================================================= */

function connectSocket(){

  if(
    typeof window.io !== "function"
  ){

    console.error(
      "MTERMS32: Socket.IO client not loaded."
    );

    return;

  }


  socket =
    window.io(
      M32_SERVER +
      "/mterms32",

      {
        transports:[
          "websocket",
          "polling"
        ],

        withCredentials:true
      }
    );


  socket.on(
    "connect",
    ()=>{

      const profile =
        getProfile() || {};


      socket.emit(
        "irc:identify",
        {

          nickname:
            profile.name || "",

          title:
            profile.title || "",

          affiliation:
            profile.affiliation || "",

          participantId:
            getParticipantId()

        }
      );


      Object
        .keys(CHANNELS)
        .forEach(channel => {

          requestHistory(
            channel
          );

        });

    }
  );


  socket.on(
    "irc:history",
    payload => {

      if(
        !payload ||
        !CHANNELS[
          payload.channel
        ]
      ){
        return;
      }


      channelMessages[
        payload.channel
      ] =
        Array.isArray(
          payload.messages
        )
          ? payload.messages
          : [];


      if(
        activeTab ===
        payload.channel
      ){

        renderActiveTab();

      }

    }
  );


  socket.on(
    "irc:message",
    message => {

      if(
        !message ||
        !CHANNELS[
          message.channel
        ]
      ){
        return;
      }


      channelMessages[
        message.channel
      ]
      .push(message);


      /*
        Keep local memory reasonable.
      */
      if(
        channelMessages[
          message.channel
        ].length > 150
      ){

        channelMessages[
          message.channel
        ] =
          channelMessages[
            message.channel
          ]
          .slice(-150);

      }


      if(
        activeTab ===
        message.channel &&
        opened
      ){

        renderActiveTab();

      }else{

        markChannelActivity(
          message.channel
        );

      }


      if(
        minimized ||
        !opened
      ){

        document
          .getElementById(
            "m32-launcher"
          )
          .classList
          .add(
            "m32-activity"
          );

      }

    }
  );


socket.on(
  "irc:presence",
  message => {

    if(
      !message ||
      !CHANNELS[
        message.channel
      ]
    ){
      return;
    }


    channelMessages[
      message.channel
    ]
    .push(message);


    if(
      channelMessages[
        message.channel
      ].length > 150
    ){

      channelMessages[
        message.channel
      ] =
        channelMessages[
          message.channel
        ]
        .slice(-150);

    }


    /*
      If we're currently looking at
      this room, display immediately.
    */
    if(
      activeTab ===
        message.channel &&
      opened
    ){

      renderActiveTab();

    }else{

      /*
        Otherwise highlight that
        channel's tab.
      */
      markChannelActivity(
        message.channel
      );

    }


    /*
      If MTERMS32 is minimized,
      flash the launcher.
    */
    if(
      minimized ||
      !opened
    ){

      document
        .getElementById(
          "m32-launcher"
        )
        .classList
        .add(
          "m32-activity"
        );

    }

  }
);
   
  socket.on(
    "irc:nicks",
    payload => {

      if(
        !payload ||
        !CHANNELS[
          payload.channel
        ]
      ){
        return;
      }


      channelNicks[
        payload.channel
      ] =
        Array.isArray(
          payload.nicknames
        )
          ? payload.nicknames
          : [];


      if(
        activeTab ===
        payload.channel
      ){

        renderNickList();

        updateStatusBar();

      }

    }
  );


  socket.on(
    "disconnect",
    ()=>{

      addStatusLine(
        "*** Disconnected from MTERMSnet"
      );

    }
  );

}


/* =========================================================
   CONNECTION THEATRE
========================================================= */

function runConnectionSequence(){

  statusLines = [];


  const sequence = [

    "*** Connecting to MTERMSnet...",

    "*** Looking up your hostname...",

    "*** Found your hostname",

    "*** Connected to irc.mterms2026.net",

    "*** Welcome to the MTERMS Internet Relay Chat Network",

    "*** Your nickname is " +
      profileNick(),

    "*** MOTD: Welcome back. It's been a while.",

    "*** Joining #kampung...",

    "*** Joining #mamak...",

    "*** Joining #lagenda..."

  ];


  let index = 0;


  function next(){

    if(
      index >=
      sequence.length
    ){

      setTimeout(
        ()=>{

          switchTab(
            "#kampung"
          );

        },
        350
      );

      return;

    }


    addStatusLine(
      sequence[index]
    );


    index++;


    setTimeout(
      next,
      130
    );

  }


  next();

}


/* =========================================================
   TABS
========================================================= */

function switchTab(tab){

  if(
    tab !== "status" &&
    !CHANNELS[tab]
  ){
    return;
  }


  activeTab =
    tab;


  if(
    tab !== "status"
  ){

    localStorage.setItem(
      STORAGE.lastChannel,
      tab
    );


    activityTabs.delete(
      tab
    );


    socket?.emit(
      "irc:active-channel",
      {
        channel:tab
      }
    );


    requestHistory(
      tab
    );

  }


  updateTabStyles();

  renderActiveTab();

  updateStatusBar();

}


function markChannelActivity(
  channel
){

  if(
    channel === activeTab &&
    opened
  ){
    return;
  }


  activityTabs.add(
    channel
  );


  updateTabStyles();

}


function updateTabStyles(){

  document
    .querySelectorAll(
      "[data-m32-tab]"
    )
    .forEach(button => {

      const tab =
        button.dataset.m32Tab;


      button.classList.toggle(
        "m32-active",
        tab === activeTab
      );


      button.classList.toggle(
        "m32-tab-activity",
        activityTabs.has(tab)
      );

    });

}


/* =========================================================
   HISTORY
========================================================= */

function requestHistory(
  channel
){

  if(
    !socket ||
    !socket.connected
  ){
    return;
  }


  socket.emit(
    "irc:history",
    {
      channel
    }
  );

}


/* =========================================================
   STATUS
========================================================= */

function addStatusLine(
  message
){

  statusLines.push(
    message
  );


  if(
    statusLines.length >
    100
  ){

    statusLines =
      statusLines.slice(-100);

  }


  if(
    activeTab === "status"
  ){

    renderActiveTab();

  }

}


/* =========================================================
   RENDER
========================================================= */

function renderActiveTab(){

  const childTitle =
    document.getElementById(
      "m32-child-title"
    );

  const inputBar =
    document.getElementById(
      "m32-inputbar"
    );

  const nicks =
    document.getElementById(
      "m32-nicks"
    );


  if(
    activeTab === "status"
  ){

    childTitle.textContent =
      "Status - MTERMSnet";


    inputBar.classList.add(
      "m32-input-disabled"
    );


    nicks.classList.add(
      "m32-nicks-hidden"
    );


    renderStatusLines();

  }else{

    childTitle.textContent =
      activeTab;


    inputBar.classList.remove(
      "m32-input-disabled"
    );


    nicks.classList.remove(
      "m32-nicks-hidden"
    );


    renderChannelMessages();

    renderNickList();

  }


  document
    .getElementById(
      "m32-title-text"
    )
    .textContent =
      activeTab === "status"
        ? "MTERMS32 - Status"
        : "MTERMS32 - [" +
          activeTab +
          "]";


  updateStatusBar();

}


function renderStatusLines(){

  const target =
    document.getElementById(
      "m32-chat-scroll"
    );


  target.innerHTML =
    statusLines
      .map(line => `
        <div
          class="
            m32-line
            m32-line-status
          "
        >
          ${escapeHTML(line)}
        </div>
      `)
      .join("");


  scrollChatBottom();

}


function renderChannelMessages(){

  const target =
    document.getElementById(
      "m32-chat-scroll"
    );


  const topic =
    CHANNELS[
      activeTab
    ]?.topic || "";


  const systemTop = `

    <div
      class="
        m32-line
        m32-line-system
      "
    >
      *** Now talking in
      ${escapeHTML(activeTab)}
    </div>

    <div
      class="
        m32-line
        m32-line-system
      "
    >
      *** Topic is
      '${escapeHTML(topic)}'
    </div>

    <div
      class="
        m32-line
        m32-line-system
      "
    >
      *** Set by @MTERMSnet
    </div>

    <div
      class="
        m32-line
        m32-line-system
      "
    >
      *** @MTERMSnet sets mode: +nt
    </div>

  `;


  const messages =
    channelMessages[
      activeTab
    ] || [];


  target.innerHTML =
    systemTop +
    messages
      .map(
        messageHTML
      )
      .join("");


  scrollChatBottom();

}


function messageHTML(
  item
){

  if(
    item.messageType === "join"
  ){

    return `
      <div
        class="
          m32-line
          m32-line-join
        "
      >
        ***
        ${escapeHTML(item.message)}
      </div>
    `;

  }


  if(
    item.messageType === "leave"
  ){

    return `
      <div
        class="
          m32-line
          m32-line-leave
        "
      >
        ***
        ${escapeHTML(item.message)}
      </div>
    `;

  }


  if(
    item.messageType === "system"
  ){

    return `
      <div
        class="
          m32-line
          m32-line-system
        "
      >
        ***
        ${escapeHTML(item.message)}
      </div>
    `;

  }


  if(
    item.messageType === "bot"
  ){

    return `
      <div
        class="
          m32-line
          m32-line-bot
        "
      >
        &lt;${escapeHTML(item.nickname)}&gt;
        ${escapeHTML(item.message)}
      </div>
    `;

  }


  return `
    <div
      class="
        m32-line
        m32-line-chat
      "
    >
      &lt;<span class="m32-nick">${escapeHTML(item.nickname)}</span>&gt;
      ${escapeHTML(item.message)}
    </div>
  `;

}


function renderNickList(){

  if(
    activeTab === "status"
  ){
    return;
  }


  const target =
    document.getElementById(
      "m32-nicks"
    );


  const bots =
    BOT_NICKS[
      activeTab
    ] || [];


  const real =
    channelNicks[
      activeTab
    ] || [];


  const unique = [];


  real.forEach(person => {

    if(
      !unique.some(
        existing =>
          existing.nickname ===
          person.nickname
      )
    ){

      unique.push(person);

    }

  });


  unique.sort(
    (a,b) =>
      String(a.nickname)
        .localeCompare(
          String(b.nickname)
        )
  );


  target.innerHTML = `

    <div class="m32-nick-title">
      Nicks:
      ${bots.length + unique.length}
    </div>


    ${bots.map(nick => `
      <div
        class="
          m32-nick-item
          m32-nick-bot
        "
      >
        ${escapeHTML(nick)}
      </div>
    `).join("")}


    ${unique.map(person => `
      <div
        class="m32-nick-item"
        title="${escapeHTML(
          [
            person.title,
            person.nickname,
            person.affiliation
          ]
          .filter(Boolean)
          .join(" · ")
        )}"
      >
        ${escapeHTML(
          person.nickname
        )}
      </div>
    `).join("")}

  `;

}


function scrollChatBottom(){

  const target =
    document.getElementById(
      "m32-chat-scroll"
    );


  requestAnimationFrame(
    ()=>{

      target.scrollTop =
        target.scrollHeight;

    }
  );

}


/* =========================================================
   SEND MESSAGE
========================================================= */

function sendMessage(){

  if(
    activeTab === "status"
  ){
    return;
  }


  const input =
    document.getElementById(
      "m32-input"
    );


  const message =
    input.value
      .trim()
      .slice(0,500);


  if(!message){
    return;
  }


  if(
    !socket ||
    !socket.connected
  ){

    addStatusLine(
      "*** Not connected to MTERMSnet"
    );

    switchTab(
      "status"
    );

    return;

  }


  socket.emit(
    "irc:message",
    {
      channel:
        activeTab,

      message
    }
  );


  input.value = "";

  input.focus();

}


/* =========================================================
   STATUS BAR
========================================================= */

function updateStatusBar(){

  const profile =
    getProfile();


  document
    .getElementById(
      "m32-status-user"
    )
    .textContent =
      (
        profile?.name ||
        "Guest"
      ) +
      " [+i]";


  document
    .getElementById(
      "m32-status-channel"
    )
    .textContent =
      activeTab;


  let users = 0;


  if(
    activeTab !== "status"
  ){

    users =
      (
        channelNicks[
          activeTab
        ] || []
      ).length +
      (
        BOT_NICKS[
          activeTab
        ] || []
      ).length;

  }


  document
    .getElementById(
      "m32-status-users"
    )
    .textContent =
      users +
      (
        users === 1
          ? " user"
          : " users"
      );


  document
    .getElementById(
      "m32-status-lag"
    )
    .textContent =
      "Lag: " +
      randomLag();

}


/* =========================================================
   FAKE LAG UPDATE
========================================================= */

setInterval(
  ()=>{

    const el =
      document.getElementById(
        "m32-status-lag"
      );


    if(el){

      el.textContent =
        "Lag: " +
        randomLag();

    }

  },
  3500
);


/* =========================================================
   INITIALISE
========================================================= */

function initialiseMterms32(){

  buildMterms32();

  updateTabStyles();

}


if(
  document.readyState ===
  "loading"
){

  document.addEventListener(
    "DOMContentLoaded",
    initialiseMterms32
  );

}else{

  initialiseMterms32();

}

})();
