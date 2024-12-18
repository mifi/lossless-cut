# Batch processing ⏩

I get a lot of questions about whether LosslessCut can help automate the same operation on X number of files. For example given a folder of 100 files, cut off 10 seconds from the beginning of every file. LosslessCut can generally not do this, however the good news is that often it's not very hard to automate with a simple script.

See also [#868](https://github.com/mifi/lossless-cut/issues/868).

## Setup FFmpeg 📀

First you need to [download and install FFmpeg](https://ffmpeg.org/) on your computer. Make sure you install it properly so that you can open a Bash terminal (Linux/macOS) or Console (Windows) and type the command `ffmpeg` (or `ffmpeg.exe` on Windows) and press <kbd>Enter</kbd>. It should then print out something like this:

```bash
ffmpeg version 7.1 Copyright (c) 2000-2024 the FFmpeg developers
```

If you cannot get it working, there here are lots of resources online on how to do this. Or you can ask an AI (for example ChatGPT) to assist you.

## Create your script 📜

Make a file `myscript.sh` (macOS/Linux) or `myscript.bat` (Windows) and edit it with a plain text editor like `nano` or Notepad.

If there's a particular operation from LosslessCut you want to automate across multiple files, you can find the command from the "Last FFmpeg commands" page. Then copy paste this command into your script. Note: if you're on Windows, the command might have to be altered slightly to be compatible (you can use an AI for this).

## Using AI 🤖

I wish more people were aware of this: large language models like ChatGPT can be incredibly useful for helping non-programmers with simple scripting tasks as well as helping you learn things, and it's free! Basically you just ask the AI to write a script for you to do whatever you need. If it doesn't work, you can continue the conversation with the AI and give it the error messages you received and it will try to help your get it working.

Start your sentence with your operating system, e.g. "I am using Windows 10", then try to be so exact and concise as possible to describe what kind of files you have and what you want to do with them to the AI using FFmpeg. Example prompt:

> I am on macOS. Please help me write a script that for each *.mp4 file in a specified folder, losslessly removes the first 10 seconds from each file? Also how do I run the script? The files are inside the folder `/Users/user/my-files`. I have FFmpeg installed and running as `ffmpeg`.

### Action from LosslessCut

If there's a particular operation from LosslessCut you want to automate, you can find the command from the "Last FFmpeg commands" page. Then copy it and paste it into your AI prompt. For example:

> I am on Windows 11. I have this (UNIX bash) command: `ffmpeg -hide_banner -i 'C:\path\to\input.mp4' -map '0:1' -c copy -f adts -y 'c:\path\to\lofoten-stream-1-audio-aac.aac'`, that I want to run automatically on every *.mp4 file in a specified folder. Please help me write a script that achieves this. The files are inside the folder `C:\path\to\folder`. I have FFmpeg installed and running as `ffmpeg.exe`.

If you are on Windows and what you want to do is more complex, it might be a good idea to instruct the AI to use PowerShell instead of Batch.

### More examples

Split files into equal length segments:

> Write a script that takes a folder of *.mp4 files, then for each file, split it into an (unknown) number of files, each file of an equal length of approximately 299 seconds.

Batch rotate all files to 90 degrees:

> Write a script that takes a folder of *.mp4 files, then for each file, losslessly change the rotation to 90 degrees and output to the same folder.
