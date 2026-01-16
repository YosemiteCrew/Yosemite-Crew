in my frontend web app,
i earlier integrated the stream chat service in the chat section of this app, it actually created chat for PMS user and the client , and on PMS we have option to close chat, but now i want an addition to this chat system, i want you to add the functionality in the chat module, that now, with the existing chat support between business on PMS and client mobile app is already supported which also has close chat sessio option, now i want you to create first a whats app style header where my current logged in user name and profile pic is shown in a card based component, and below my curren chat module which is existing, but main thing is that now we need to support chat between multiple employees in a PMS business, so a facility to chat with Clients(Pet parents), option to chat with Collegues in a business, and a chat group common , do it for the web the past documentation of our chat system i am attaching for reference, make it proper mobile responsive, try approacing the switching using a pill like structure like used in multiple pages i have the filters in inventory and forms module, u can use those 

http://localhost:3000/settings here u can get my name and profile pic from the service which is used in this page, 

also my current implementation check deeply if needed refer the [BACKEND_CHAT_IMPLEMENTATION.md](Guides/BACKEND_CHAT_IMPLEMENTATION.md) , and update this guide for backend implementation,this is the old guide 
also solve below error :
ChatContainer.tsx:314 In HTML, <button> cannot be a descendant of <button>.
This will cause a hydration error.

  ...
    <ChatLayout filters={{type:"mess...", ...}} sort={[...]} options={{state:true, ...}} isMobile={false} ...>
      <div className="str-chat__...">
        <div className="str-chat__..." style={{display:"flex"}}>
          <UnMemoizedChannelList filters={{type:"mess...", ...}} sort={[...]} options={{state:true, ...}} ...>
            <ChannelListContextProvider value={{channels:[...], ...}}>
              <div className="str-chat s..." ref={{...}}>
                <ChannelListMessenger error={null} loadedChannels={undefined} loading={false} ...>
                  <div className="str-chat__...">
                    <div aria-label="Channel list" className="str-chat__..." role="listbox">
                      <UnMemoizedLoadMorePaginator hasNextPage={false} isLoading={false} ...>
                        <ChannelPreview activeChannel={{...}} Avatar={function Avatar} channel={{...}} ...>
                          <ChatChannelPreview activeChannel={{...}} Avatar={function Avatar} channel={{...}} ...>
                            <ChannelPreviewWrapper activeChannel={{...}} Avatar={function Avatar} channel={{...}} ...>
>                             <button
>                               type="button"
>                               tabIndex={0}
>                               className="chat-preview-trigger"
>                               onClick={function handlePreviewSelect}
>                               onKeyDown={function handleKeyDown}
>                               style={{cursor:"pointer",background:"none",border:"none",padding:0,margin:0,textAlign:"left",width:"100%"}}
>                             >
                                <UnMemoizedChannelPreviewMessenger activeChannel={{...}} Avatar={function Avatar} ...>
                                  <div className="str-chat__...">
                                    <ChannelPreviewActionButtons channel={{...}}>
                                      <div className="str-chat__...">
>                                       <button
>                                         aria-label="Pin"
>                                         className="str-chat__channel-preview__action-button str-chat__channel-previe..."
>                                         onClick={function onClick}
>                                         title="Pin"
>                                       >
                                        ...
                                    ...
                        ...
        ...
<UnMemoizedChannelPreviewMessenger>		
ChannelPreviewWrapper	@	ChatContainer.tsx:314
<ChannelPreviewWrapper>		
PreviewComponent	@	ChatContainer.tsx:330
<UnMemoizedChannelList>		
ChatLayout	@	ChatContainer.tsx:508
<ChatLayout>		
ChatContainer	@	ChatContainer.tsx:669
<ChatContainer>		
ChatPageContent	@	page.tsx:27
<ChatPageContent>		
ChatPage	@	page.tsx:37
"use client"		
Promise.all	@	VM1556 <anonymous>:1
await in fetchServerResponse		
handleClick	@	Sidebar.tsx:57
onClick	@	Sidebar.tsx:87
ChatContainer.tsx:298 <button> cannot contain a nested <button>.
See this log for the ancestor stack trace.
﻿

