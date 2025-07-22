# Forum Thread Flair System

This feature automatically prompts users to categorize their forum posts with appropriate flair when they create new threads in designated forum channels.

## Setup

1. **Configure Forum Channels**: Use the `/forum-flair` command to manage which forum channels should use the flair system.

   ```
   /forum-flair add channel:#your-forum-channel
   /forum-flair remove channel:#your-forum-channel
   /forum-flair list
   ```

2. **Permissions**: The setup commands require `Manage Channels` permission.

## How It Works

When a user creates a new thread in a configured forum channel:

1. **Thread Lock**: The thread is immediately locked
2. **Flair Selection**: A message appears with category options:
   - "I'm an artist looking for work" → **Portfolio** flair
   - "I'm looking for an artist" → Secondary options for job type
   - "I'm hosting an event" → Secondary options for event type  
   - "I'd like to share something" → Secondary options for content type

3. **Secondary Categories**:
   - **Looking for Artist**:
     - "Paid up front" → **Paid Job** flair
     - "Revenue sharing" → **Revenue Share** flair
     - "Open project" → **Collaboration** flair (+ optional Official status)
   
   - **Hosting Event**:
     - "Artists compete" → **Contest** flair
     - "Artists collaborate" → **Collaboration** flair (+ optional Official status)
     - "Submit for fun" → **Event** flair
   
   - **Sharing**:
     - "Low-spec resource" → **Resource** flair
     - "Livestream" → **Livestream** flair

4. **Official Status**: Users with `Manage Threads` or `Administrator` permissions can mark collaborations as **Official**

5. **Completion**: Thread unlocks, flair selection message is removed, user gets confirmation

## Forum Tags

The system automatically creates forum tags with emojis:
- 🎨 Portfolio
- 💰 Paid Job  
- 🤝 Revenue Share
- 👥 Collaboration
- 🏆 Contest
- 🎉 Event
- 📚 Resource
- 📺 Livestream
- ⭐ Official

## Security

- Only the thread creator can interact with flair buttons
- Other users get an ephemeral error message if they try to interact
- Moderator-only features require appropriate permissions
