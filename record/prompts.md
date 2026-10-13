# Prompts

## Initial draft, 30 Sep 2026

<!-- Record Voice and Screen Tools: https://chatgpt.com/c/6abcb43c-05a4-83ec-88a4-30442ef8e799?src=history_search -->

What are popular, modern, free, well-designed sites / apps where I can just visit, speak, have it record my audio, save it, and let me share it via a public URL - available for at least a few weeks or permanently? This is the core feature I need. Before building something I thought I'd check if such a thing exists.

---

I guess I could build a tool to do this easily - that way I'd have control over the content in the future.

I usually compress audio aggressively into a .opus file with these ffmpeg options: -c:a libopus -b:a 12k -ac 1 -application voip -vbr on -compression_level 10

Can I get this level of compression, or close, or better, using browser native features on the latest Edge / Chrome?

---

Actually, I'm OK with .webm. Can you test on [LocalMCP2](/plugins/plugin_asdk_app_6ab0b6c561508191882e58b23665db3e) using my browser via CDP localhost:9222 to see what's supported and how well MediaRecorder vs AudioEncoder would compress while preserving quality? If you need me to speak or something, let me know and I'll do that.

---

Next, can I use any of the (modern) browser file system APIs to automatically save the file in one of my directories? If I give it permission once to write into a directory, will it persist if I visit the page again? I would like the recordings to keep getting added as new files in a specific directory on my machine, and maybe have the option of changing it later.

---

OK. Create a new tool in ~/code/tools/record/ that will let me record an audio and, which I stop, save it in a directory. Allow pause/resume if it's easy. Show a waveform of speaker volume moving (like most transcription applications) so that I can see about 5 seconds of audio amplitude at any point, updated continuously, so that I know if it's too loud / soft. Research and use best practices for such audio transcriber volume visualizations. If I've picked a directory, I shouldn't need to pick it again - it should automatically be saved there - but I should be able to change it later. The filename will be the timestamp: YYYY-MM-DD-HH-MM-SS.webm. The filename should be automatically added to the clipboard when the recording is saved. Take a look at the directory and follow relevant conventions and update related files - e.g. the parent tools.json, README.md, anything else.

---

I tried it and it works. A few revisions:

- Don't copy the filename on "Stop and save".
- When the user clicks "Stop and save" add a file to the list of saved items (in the session - no need to persist anything). That list item should include:
- An audio control to listen to the audio
- A copy button to copy the filename
- A delete button that lets them delete just that audio - which should delete the file on the system and, once done, from the list
- Clear the visualization and the duration timer and change the label back to "Ready to record". That lets the user know it's ready for the next recording
- Make the UI smaller vertically. Feel free to occupy the full width (e.g. .container-fluid)
- Keep the following in one row (mobile-responsive): "Record a voice note" (no subtitle required), the "Save recordings to" control, and the Change button.
- Keep the volume visualization and the record timer + control in one row (mobile-responsive).
- We will, soon, plan to add a "Record screen" as well, so change the title and home page content (README.md, tools.json, etc.) to reflect that this records audio and screen. The page title can be just "Record" and the section can be "Record a voice note" and we'll add other sections required. The list of recorded audios should be within this audio section.

Think about how best to do this - research UI best practices, usability and user experience best practices. Focus on the INTENT of what I said - I don't need you to follow the letter as much as the spirit.

Implement this change, take a look, and let me know when you're happy.

---

Drop the "Record screen - coming next" for now. On the home page, change the description to just "Record audio and save it locally". No need to mention video. Position-wise, swap its position with Research Me (which is currently second).
