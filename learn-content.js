/* Dayblock — Learn tab content: a how-to guide and practical lessons.
   Each item: id, icon, title, summary, minutes, body (HTML), takeaways[], try[] (actions run by app.js). */
window.DAYBLOCK_LEARN = {
  guide: [
    {
      id: 'g-timeblocks', icon: '🗓️', title: 'Plan your day with time blocks', minutes: 2,
      summary: 'Give every important thing a place on your calendar.',
      body: `
        <p>The <b>Time blocks</b> section shows your day as a timeline, from midnight to midnight. Each block is a chunk of time you set aside for one thing.</p>
        <h3>Create a block</h3>
        <ul>
          <li><b>Click</b> an empty time to add a one-hour block, or <b>click and drag</b> to choose the exact length.</li>
          <li>On a phone, <b>tap</b> an empty time. Swiping always scrolls.</li>
          <li>Or press the <b>+</b> button to drop a block into your next free slot.</li>
        </ul>
        <h3>Change a block</h3>
        <ul>
          <li><b>Drag</b> a block to move it. In Week view you can drag it to another day.</li>
          <li><b>Drag its bottom edge</b> to make it longer or shorter.</li>
          <li>On a phone, <b>press and hold</b> a block to pick it up.</li>
          <li>Tap the circle to mark it done.</li>
        </ul>
        <p>Switch between <b>Day</b>, <b>Week</b> and <b>Month</b> at the top. The week strip above the timeline lets you jump between days quickly.</p>`,
      try: [{ label: 'Create my first block', action: 'block', title: 'Focus time', minutes: 60 }],
    },
    {
      id: 'g-todo', icon: '✅', title: 'Keep a to-do list', minutes: 2,
      summary: 'Capture tasks, set priorities, then schedule them.',
      body: `
        <p>The <b>To-do</b> section is for everything you need to do, whether or not it has a time yet.</p>
        <ul>
          <li>Type a task, pick a priority and an optional due date, then press <b>Add task</b>.</li>
          <li>Open a task to set <b>time needed</b>, notes, a category and repeats.</li>
          <li>Use <b>List</b> to see everything, or <b>Day / Week / Month</b> to see tasks by due date.</li>
          <li>Filters help you focus: <b>Due today</b>, <b>Linked</b>, <b>Postponed</b> and <b>Done</b>.</li>
        </ul>
        <div class="callout"><b>Tip: turn tasks into time.</b>Unscheduled tasks also appear under “Tasks to schedule” in Time blocks. Drag one onto the timeline, or press + to put it in the next free slot.</div>`,
      try: [{ label: 'Open my to-do list', action: 'view', mode: 'todo', view: 'list' }],
    },
    {
      id: 'g-repeat', icon: '🔁', title: 'Repeat things automatically', minutes: 1,
      summary: 'Daily habits, weekly meetings and monthly reviews.',
      body: `
        <p>Blocks and tasks can repeat <b>daily</b>, <b>every weekday</b>, <b>weekly</b> on the days you choose, or <b>monthly</b>. You can also repeat every few days, weeks or months, with an optional end date.</p>
        <ul>
          <li>When you change one day of a repeating block, Dayblock asks whether to change <b>only this one</b>, <b>this and following</b>, or <b>all of them</b>.</li>
          <li>When you tick off a repeating task, the next one is created for you.</li>
        </ul>`,
      try: [{ label: 'Add a daily habit', action: 'task', title: 'Drink 8 glasses of water', repeat: { freq: 'daily', interval: 1 }, due: 'today' }],
    },
    {
      id: 'g-chains', icon: '🔗', title: 'Link tasks and postpone them', minutes: 2,
      summary: 'Build task chains that move together when plans change.',
      body: `
        <h3>Linked tasks</h3>
        <p>Open a task and choose <b>Starts after</b> to make it wait for another task, like in a project management tool. For example: <i>Write draft → Edit → Publish</i>.</p>
        <ul>
          <li>If a task is postponed, every task linked after it moves by the same number of days.</li>
          <li>If a task with linked tasks isn’t finished on time, a banner asks whether to <b>push the whole chain to tomorrow</b>. You can make this automatic in Settings.</li>
          <li>See all your chains in To-do → <b>Linked</b>.</li>
        </ul>
        <h3>Postponing</h3>
        <p>Use <b>↷ Postpone</b> on a task or block to move it to tomorrow, the weekend, next week or any date, and note why. Dragging a block to a later day counts as postponing too. Dayblock keeps the history and shows a ↷ count, so you can see what keeps slipping.</p>`,
      try: [{ label: 'See my linked tasks', action: 'view', mode: 'todo', view: 'list' }],
    },
    {
      id: 'g-tracking', icon: '⏱️', title: 'Track your time', minutes: 2,
      summary: 'Start, pause and stop a timer, and see when you actually worked.',
      body: `
        <p>Press <b>▶</b> on any block or task to start the timer. The bar at the bottom shows:</p>
        <ul>
          <li>when you <b>actually started</b>, and whether that was early or late compared with your plan</li>
          <li>the <b>live clock</b>, and your planned slot</li>
        </ul>
        <p>Press <b>Pause</b> for breaks and <b>Resume</b> when you’re back. Press <b>Stop</b> when you’re finished: Dayblock records your finish time and marks the item complete.</p>
        <p>On the timeline, a slim coloured bar at the right edge of the day shows when you really tracked time, so you can compare it with your plan at a glance.</p>`,
      try: [{ label: 'Plan a block to track', action: 'block', title: 'Deep work', minutes: 90, cat: 'work' }],
    },
    {
      id: 'g-insights', icon: '📊', title: 'Read your insights', minutes: 2,
      summary: 'Planned vs. actual, punctuality, peak hours and what slips.',
      body: `
        <p><b>Insights</b> turns your plans and tracked time into clear answers for any day, week or month:</p>
        <ul>
          <li><b>Planned vs. tracked</b> time, overall, per day, per category and per item.</li>
          <li><b>Started and finished vs. plan:</b> your average start delay, how often you start on time, and whether blocks run over.</li>
          <li><b>When you actually work:</b> your most productive hours.</li>
          <li><b>Postponed:</b> what keeps moving, and why.</li>
          <li><b>What your data says:</b> short, practical tips based on your numbers.</li>
        </ul>`,
      try: [{ label: 'Open this week’s insights', action: 'view', mode: 'insights', view: 'week' }],
    },
    {
      id: 'g-vision', icon: '✨', title: 'Vision, goals and journal', minutes: 2,
      summary: 'Design the life you want, then break it into steps.',
      body: `
        <ul>
          <li><b>Vision:</b> write your vision statement, collect affirmations (one greets you every day), build a vision board, and rate your life areas on the Wheel of life.</li>
          <li><b>Goals:</b> set goals for 90 days, this year, 5 years or your lifetime. Break each goal into steps, and send any step to your to-do list with <b>+ To-do</b>. Ticking it off there updates the goal.</li>
          <li><b>Journal:</b> a quick daily check-in with your mood, gratitude, intention, manifestation scripting and reflection.</li>
        </ul>`,
      try: [{ label: 'Set a life goal', action: 'view', mode: 'vision', view: 'goals' }],
    },
    {
      id: 'g-diary', icon: '📔', title: 'Keep a diary of memories', minutes: 1,
      summary: 'Write about your days and add photos, videos and files.',
      body: `
        <p>The <b>Diary</b> is your personal record of what happened: special days, small moments, milestones and feelings.</p>
        <ul>
          <li>Add a title, the date, your mood and as much text as you like.</li>
          <li>Attach <b>photos, videos, audio and files</b> by dropping them in or browsing.</li>
          <li>Search your memories, mark favourites ♥, or browse by month in <b>Calendar</b>.</li>
        </ul>
        <div class="callout"><b>Where files are kept</b>Photos are shrunk a little and sync to your account, so they show on all your devices. Videos and other files stay on the device where you added them.</div>`,
      try: [{ label: 'Write today’s memory', action: 'diary' }],
    },
    {
      id: 'g-personal', icon: '🎨', title: 'Make it yours', minutes: 1,
      summary: 'Looks, light or dark, categories, sync and the app.',
      body: `
        <p>Open <b>Settings</b> (your name or the gear at the bottom of the sidebar, or the avatar at the top on a phone) to:</p>
        <ul>
          <li>Choose a <b>look</b>: <b>Classic</b> (the original design), <b>Aurora</b> (soft glass), <b>Midnight</b> (dark glow) or <b>Paper</b> (warm ink), each in light or dark.</li>
          <li>Create your own <b>categories</b> with any name and colour.</li>
          <li>Set your day hours, the first day of the week, and what happens when linked tasks run late.</li>
          <li>Sign in with Google or email to <b>sync across devices</b>, export a backup, or install Dayblock as an app.</li>
        </ul>`,
      try: [{ label: 'Open Settings', action: 'settings' }],
    },
  ],

  lessons: [
    {
      id: 'l-timeblocking', icon: '🧱', cat: 'Time', minutes: 4, title: 'Time blocking 101',
      summary: 'Why a calendar beats a to-do list for getting important work done.',
      body: `
        <p>A to-do list tells you <i>what</i> to do. Time blocking also decides <i>when</i>. Instead of reacting to whatever feels urgent, you give your priorities a fixed place in the day before the day starts.</p>
        <h2>Why it works</h2>
        <ul>
          <li><b>It makes trade-offs visible.</b> A list can hold 30 items. A day only holds 24 hours. Blocking shows you, honestly, what fits.</li>
          <li><b>It removes decision fatigue.</b> When a block starts, you already know what to work on.</li>
          <li><b>It protects focus.</b> One block, one thing. Switching between tasks has a real cost in attention.</li>
        </ul>
        <h2>How to start</h2>
        <ol>
          <li>Each evening (or first thing in the morning), look at your tasks and pick your top 1–3 priorities.</li>
          <li>Block those first, ideally in the hours when you have the most energy.</li>
          <li>Add blocks for meetings, meals, exercise and <b>breaks</b>. Rest is part of the plan.</li>
          <li>Group small tasks (email, calls, admin) into one “batch” block instead of scattering them.</li>
          <li>Leave buffer time. A plan with no slack breaks the moment something runs over.</li>
        </ol>
        <div class="callout"><b>When the plan breaks (it will)</b>Don’t abandon it. Just move the blocks. The value is in deciding deliberately, not in following a perfect schedule.</div>`,
      takeaways: ['Decide when, not just what.', 'Block priorities first, in your best hours.', 'Plan breaks and buffers.', 'Re-plan instead of giving up.'],
      try: [{ label: 'Block my top priority today', action: 'block', title: 'Top priority', minutes: 90 }],
    },
    {
      id: 'l-frog', icon: '🐸', cat: 'Focus', minutes: 3, title: 'Do the hard thing first',
      summary: 'Start your day with the task you most want to avoid.',
      body: `
        <p>Most days have one task that matters more than the rest, and it’s usually the one we put off: the difficult call, the report, the decision. Doing it first changes how the whole day feels.</p>
        <h2>Why mornings help</h2>
        <ul>
          <li>Your attention is fresher before the inbox and meetings start pulling at it.</li>
          <li>Finishing something important early creates momentum and lowers stress for the rest of the day.</li>
          <li>Dread costs energy. The longer a task waits, the bigger it feels.</li>
        </ul>
        <h2>Make it practical</h2>
        <ol>
          <li>The night before, decide your “hard thing” for tomorrow and write it down.</li>
          <li>Block the first 60–90 minutes of your work day for it.</li>
          <li>Don’t open email or messages until the block ends.</li>
          <li>If it’s too big, define just the first concrete step, like “write the outline”.</li>
        </ol>`,
      takeaways: ['Pick tomorrow’s hard thing tonight.', 'Do it before email and messages.', 'Shrink it to a first step if needed.'],
      try: [{ label: 'Block tomorrow’s hard thing', action: 'block', title: 'The hard thing', minutes: 90 }],
    },
    {
      id: 'l-eisenhower', icon: '🧭', cat: 'Planning', minutes: 4, title: 'Urgent vs. important',
      summary: 'Sort tasks into four boxes so the important ones don’t get crowded out.',
      body: `
        <p>Urgent things shout; important things whisper. The <b>urgent–important matrix</b> helps you notice the difference by sorting tasks into four boxes:</p>
        <ul>
          <li><b>Important and urgent:</b> do it now (a real deadline today, a crisis).</li>
          <li><b>Important, not urgent:</b> <b>schedule it.</b> Planning, health, learning, relationships, deep work. This is where growth happens.</li>
          <li><b>Urgent, not important:</b> delegate it, batch it, or keep it short. Many interruptions live here.</li>
          <li><b>Neither:</b> drop it.</li>
        </ul>
        <h2>Using it in Dayblock</h2>
        <ul>
          <li>Use <b>High priority</b> for important tasks, whether urgent or not.</li>
          <li>Give important-but-not-urgent work a <b>time block</b> each week, or it will never happen on its own.</li>
          <li>Batch the urgent-not-important tasks into one short daily admin block.</li>
        </ul>
        <div class="callout"><b>A good sign</b>If you spend more time each week in “important, not urgent”, you will usually have fewer emergencies later.</div>`,
      takeaways: ['Urgency is not importance.', 'Schedule important, non-urgent work on purpose.', 'Batch or delegate the noisy stuff.'],
      try: [{ label: 'Add a weekly planning task', action: 'task', title: 'Plan important, non-urgent work', repeat: { freq: 'weekly', interval: 1 }, due: 'today', priority: 'high' }],
    },
    {
      id: 'l-pomodoro', icon: '🍅', cat: 'Focus', minutes: 3, title: 'Focus sprints and breaks',
      summary: 'Work in short, focused rounds with real breaks in between.',
      body: `
        <p>Long stretches of “I’ll just work until it’s done” often turn into scrolling and half-focus. Short, timed sprints make starting easier and keep your attention sharp.</p>
        <h2>The basic rhythm</h2>
        <ol>
          <li>Choose one task.</li>
          <li>Work for <b>25 minutes</b> with no switching.</li>
          <li>Take a <b>5-minute break</b>: stand up, stretch, look away from screens.</li>
          <li>After four rounds, take a longer break of 15–30 minutes.</li>
        </ol>
        <h2>Adjust it to you</h2>
        <ul>
          <li>For deep creative work, 50 minutes on and 10 off often works better.</li>
          <li>If you’re resisting a task, promise yourself just one sprint. Starting is the hardest part.</li>
          <li>Write down any distracting thought on paper and return to the task.</li>
        </ul>
        <p>In Dayblock, block the sprint, press ▶ and pause the timer during breaks. Insights will show how your real focus time compares with your plan.</p>`,
      takeaways: ['One task per sprint.', 'Breaks are part of the method.', 'Use a sprint to beat resistance.'],
      try: [{ label: 'Block a 25-minute sprint', action: 'block', title: 'Focus sprint', minutes: 25 }, { label: 'Block a 5-minute break', action: 'block', title: 'Break', minutes: 5, cat: 'break' }],
    },
    {
      id: 'l-deepwork', icon: '🌊', cat: 'Focus', minutes: 4, title: 'Deep work',
      summary: 'Protect long, distraction-free blocks for your most valuable work.',
      body: `
        <p><b>Deep work</b> is focused effort on something cognitively demanding: writing, designing, coding, studying, solving a hard problem. It produces most of the value, yet it is the first thing interruptions destroy.</p>
        <h2>Set up for it</h2>
        <ul>
          <li><b>Block it:</b> 60–120 minutes, at the same time on several days a week if you can. Routine lowers the effort of starting.</li>
          <li><b>Remove triggers:</b> phone in another room, notifications off, only the tabs you need.</li>
          <li><b>Define the outcome:</b> “Finish section 2”, not “work on the report”.</li>
          <li><b>Have a ritual:</b> the same drink, music or desk setup tells your brain it’s time to focus.</li>
        </ul>
        <h2>Train the muscle</h2>
        <p>Focus is a skill. If 90 minutes feels impossible, start with 30 and add 10 minutes each week. Track it, and use Insights to see your peak hours, then move your deep work there.</p>`,
      takeaways: ['Deep work creates most of the value.', 'Protect it with time, place and ritual.', 'Build up your focus gradually.'],
      try: [{ label: 'Block a deep work session', action: 'block', title: 'Deep work', minutes: 90, cat: 'work' }],
    },
    {
      id: 'l-planning-fallacy', icon: '📏', cat: 'Time', minutes: 3, title: 'Why everything takes longer',
      summary: 'Beat the planning fallacy by estimating from real data.',
      body: `
        <p>People tend to underestimate how long tasks will take, even when they know similar tasks ran late before. This is often called the <b>planning fallacy</b>. We picture the best case and forget the interruptions, setup time and surprises.</p>
        <h2>How to plan more realistically</h2>
        <ul>
          <li><b>Use your own history.</b> Track a few similar tasks and compare planned with actual time. Dayblock’s Insights shows this per block.</li>
          <li><b>Add a buffer.</b> If your blocks usually run 20% over, plan 20% more time.</li>
          <li><b>Break tasks down.</b> Estimating five small steps is more accurate than one big blob.</li>
          <li><b>Plan transitions.</b> Getting started, switching context and wrapping up all take time.</li>
        </ul>
        <div class="callout"><b>A useful question</b>“How long did this actually take last time?” is more reliable than “How long should this take?”</div>`,
      takeaways: ['We all underestimate.', 'Plan from your tracked history.', 'Add buffers and break tasks down.'],
      try: [{ label: 'Check planned vs. actual', action: 'view', mode: 'insights', view: 'week' }],
    },
    {
      id: 'l-weekly-review', icon: '🔄', cat: 'Planning', minutes: 4, title: 'The weekly review',
      summary: 'A 30-minute ritual that keeps your whole life on track.',
      body: `
        <p>Daily planning keeps today on track. A <b>weekly review</b> keeps your weeks pointed in the right direction. Pick a fixed time, like Sunday evening or Friday afternoon.</p>
        <h2>A simple review in five steps</h2>
        <ol>
          <li><b>Clear:</b> empty your head. Add every loose task, idea and worry to your to-do list.</li>
          <li><b>Look back:</b> open Insights for the week. What went well? What slipped, and why?</li>
          <li><b>Check your goals:</b> in Vision → Goals, is each active goal moving? Add the next step for each.</li>
          <li><b>Plan ahead:</b> look at next week. Block your priorities, deep work, exercise and rest first.</li>
          <li><b>Reflect:</b> write a few lines in your journal. What did you learn? What will you do differently?</li>
        </ol>
        <p>The review is where you notice patterns, like a task that keeps getting postponed, before they become problems.</p>`,
      takeaways: ['Same time every week.', 'Look back, then plan ahead.', 'Connect weekly plans to your goals.'],
      try: [{ label: 'Add a weekly review (Sundays)', action: 'task', title: 'Weekly review', repeat: { freq: 'weekly', interval: 1, days: [0] }, due: 'sunday', estimate: 30, priority: 'high' }],
    },
    {
      id: 'l-goals', icon: '🎯', cat: 'Growth', minutes: 4, title: 'Goals that actually happen',
      summary: 'Make goals specific, measurable and broken into next steps.',
      body: `
        <p>“Get fit” is a wish. “Run a 5K in under 30 minutes by June” is a goal. The difference is clarity, and clarity makes action possible.</p>
        <h2>Make goals SMART</h2>
        <ul>
          <li><b>Specific:</b> what exactly?</li>
          <li><b>Measurable:</b> how will you know you’re done?</li>
          <li><b>Achievable:</b> a stretch, but realistic.</li>
          <li><b>Relevant:</b> does it matter to you, and why?</li>
          <li><b>Time-bound:</b> by when?</li>
        </ul>
        <h2>From big to small</h2>
        <p>Think in layers: a <b>lifetime</b> vision, <b>5-year</b> ambitions, goals for <b>this year</b>, and focus for the <b>next 90 days</b>. Each layer feeds the next. Ninety days is long enough to make real progress and short enough to stay urgent.</p>
        <h2>Always know the next step</h2>
        <p>A goal without a next step stays a dream. For every goal, write the next concrete action, send it to your to-do list, and give it a time block.</p>
        <div class="callout"><b>Write your “why”</b>When motivation drops, the reason the goal matters to you is what keeps you going. Dayblock lets you save it with each goal.</div>`,
      takeaways: ['Specific beats vague.', 'Plan in layers: life, 5 years, year, 90 days.', 'Every goal needs a next step and a why.'],
      try: [{ label: 'Set a 90-day goal', action: 'view', mode: 'vision', view: 'goals' }],
    },
    {
      id: 'l-habits', icon: '🌱', cat: 'Growth', minutes: 4, title: 'Building habits that stick',
      summary: 'Small, easy, repeated actions beat big bursts of motivation.',
      body: `
        <p>Motivation comes and goes. Habits keep working when motivation is low. The goal is to make good behaviour automatic.</p>
        <h2>Principles that help</h2>
        <ul>
          <li><b>Start tiny.</b> Two push-ups, one page, one minute of meditation. Make it so easy you can’t say no, then grow it.</li>
          <li><b>Attach it to an existing routine:</b> “After I pour my morning coffee, I will write three things I’m grateful for.”</li>
          <li><b>Make it obvious:</b> put the book on your pillow and the running shoes by the door.</li>
          <li><b>Make it satisfying:</b> tick it off, watch your streak grow, celebrate small wins.</li>
          <li><b>Never miss twice.</b> Missing once is normal. Missing twice starts a new habit of skipping.</li>
        </ul>
        <h2>Identity matters</h2>
        <p>Instead of “I want to run”, think “I’m becoming a runner”. Every small repetition is a vote for the person you want to be.</p>`,
      takeaways: ['Start tiny and build up.', 'Stack new habits onto existing ones.', 'Never miss twice.'],
      try: [{ label: 'Add a tiny daily habit', action: 'task', title: '2-minute habit: read one page', repeat: { freq: 'daily', interval: 1 }, due: 'today', estimate: 15 }],
    },
    {
      id: 'l-procrastination', icon: '🐢', cat: 'Mindset', minutes: 4, title: 'Beating procrastination',
      summary: 'Procrastination is about feelings, not laziness. Work with them.',
      body: `
        <p>We rarely put things off because we’re lazy. We put them off because the task brings up an uncomfortable feeling: it’s boring, confusing, scary, or we fear doing it badly. Avoiding it brings short-term relief, and that relief is what keeps the loop going.</p>
        <h2>Ways to break the loop</h2>
        <ul>
          <li><b>Name the feeling.</b> “I’m avoiding this because I don’t know where to start.” Naming it makes it smaller.</li>
          <li><b>Find the next physical action.</b> Not “do taxes” but “find last year’s tax form”.</li>
          <li><b>Use a 5-minute rule.</b> Commit to just five minutes. Usually you’ll keep going.</li>
          <li><b>Lower the bar.</b> Give yourself permission to do a rough first version.</li>
          <li><b>Be kind to yourself.</b> Self-criticism adds to the bad feeling and tends to make procrastination worse, not better.</li>
        </ul>
        <div class="callout"><b>Notice your patterns</b>In Dayblock, the “Postponed” filter and Insights show which tasks keep slipping. Those are the ones to break into smaller steps.</div>`,
      takeaways: ['Procrastination is emotional avoidance.', 'Shrink the task to one physical action.', 'Five minutes is enough to start.', 'Self-compassion helps more than guilt.'],
      try: [{ label: 'See what I keep postponing', action: 'view', mode: 'todo', view: 'list' }],
    },
    {
      id: 'l-energy', icon: '🔋', cat: 'Wellbeing', minutes: 4, title: 'Manage energy, not just time',
      summary: 'Match tasks to your energy and recharge on purpose.',
      body: `
        <p>Two hours at peak energy can produce more than a whole day running on empty. Managing your <b>energy</b> is as important as managing your schedule.</p>
        <h2>Know your rhythm</h2>
        <p>Most people have a few hours of high alertness, often in the morning, and a dip in the early afternoon. Track your time for a couple of weeks and check <b>When you actually work</b> in Insights to find your peak.</p>
        <ul>
          <li><b>Peak hours:</b> deep, creative, important work.</li>
          <li><b>Dips:</b> admin, email, errands, meetings.</li>
          <li><b>Low evenings:</b> light planning, reflection, rest.</li>
        </ul>
        <h2>Recharge deliberately</h2>
        <ul>
          <li><b>Sleep</b> is the foundation. Protect a consistent bedtime.</li>
          <li><b>Move:</b> short walks and exercise boost energy and mood.</li>
          <li><b>Take real breaks:</b> step away from screens between blocks.</li>
          <li><b>Eat and hydrate</b> regularly. Hunger and dehydration quietly drain focus.</li>
        </ul>`,
      takeaways: ['Schedule hard work at your peak.', 'Put admin in your energy dips.', 'Sleep, movement and breaks are productivity tools.'],
      try: [{ label: 'Block a walk break', action: 'block', title: 'Walk outside', minutes: 20, cat: 'health' }, { label: 'Find my peak hours', action: 'view', mode: 'insights', view: 'month' }],
    },
    {
      id: 'l-visualization', icon: '🔮', cat: 'Mindset', minutes: 4, title: 'Visualization and manifestation, practically',
      summary: 'Use vision to guide action, and plan for the obstacles too.',
      body: `
        <p>Picturing the life you want can be powerful. It clarifies what you care about and makes opportunities easier to notice. But dreaming alone isn’t enough. Visualization works best when it’s connected to action.</p>
        <h2>A practical approach: dream, then plan</h2>
        <ol>
          <li><b>Wish:</b> name something you truly want, like “Feel healthy and strong”.</li>
          <li><b>Outcome:</b> imagine the best result vividly. How does it feel? What does a day look like?</li>
          <li><b>Obstacle:</b> now picture what is likely to get in your way, especially inside you: tiredness, doubt, habits.</li>
          <li><b>Plan:</b> make an if-then plan. “If I feel too tired to exercise after work, then I’ll do 10 minutes at home.”</li>
        </ol>
        <p>Thinking about the obstacle, not only the dream, tends to turn wishes into commitments.</p>
        <h2>In Dayblock</h2>
        <ul>
          <li>Write your <b>vision statement</b> in the present tense, as if it’s already true.</li>
          <li>Add <b>affirmations</b> that reflect who you’re becoming, and read the daily one.</li>
          <li>Use <b>manifestation scripting</b> in the journal, then turn insights into goals and steps.</li>
        </ul>`,
      takeaways: ['See it clearly, then plan for obstacles.', 'Use if-then plans for the hard moments.', 'Vision should lead to a next step.'],
      try: [{ label: 'Write my vision', action: 'view', mode: 'vision', view: 'board' }, { label: 'Open today’s journal', action: 'view', mode: 'vision', view: 'journal' }],
    },
    {
      id: 'l-gratitude', icon: '🙏', cat: 'Wellbeing', minutes: 3, title: 'Gratitude and journaling',
      summary: 'A few minutes of writing can lift your mood and clear your mind.',
      body: `
        <p>Writing about your day helps you process it. Noticing what went well trains your attention to see the good, not only the problems.</p>
        <h2>A 5-minute daily practice</h2>
        <ul>
          <li><b>Three gratitudes:</b> be specific. “The warm chat with my friend at lunch” beats “friends”.</li>
          <li><b>One intention:</b> how do you want to show up today?</li>
          <li><b>A short reflection:</b> what went well, what did you learn, and what will you change tomorrow?</li>
        </ul>
        <h2>Diary vs. journal</h2>
        <p>Use the <b>Journal</b> (in Vision) for the quick daily check-in. Use the <b>Diary</b> for the bigger story: memorable days, milestones and photos you’ll want to look back on.</p>
        <div class="callout"><b>Consistency over length</b>Two honest lines every day are worth more than one long entry a month. Watch your streak grow.</div>`,
      takeaways: ['Be specific with gratitude.', 'Set one intention per day.', 'Short and consistent wins.'],
      try: [{ label: 'Open today’s journal', action: 'view', mode: 'vision', view: 'journal' }, { label: 'Add a diary memory', action: 'diary' }],
    },
    {
      id: 'l-boundaries', icon: '🛡️', cat: 'Planning', minutes: 3, title: 'Saying no and protecting your time',
      summary: 'Every yes is a no to something else. Choose on purpose.',
      body: `
        <p>Your time is limited, so every commitment uses up space that could go to your priorities, your health or the people you love. Protecting your time isn’t selfish. It’s how you keep promises to yourself.</p>
        <h2>Practical boundaries</h2>
        <ul>
          <li><b>Pause before yes.</b> “Let me check my calendar and get back to you.”</li>
          <li><b>Look at your blocks.</b> If saying yes means removing a priority block, it’s really a no to that priority.</li>
          <li><b>Offer alternatives:</b> “I can’t this week, but I could do Tuesday.” Or: “I can review it, but not write it.”</li>
          <li><b>Block focus time as appointments.</b> Treat your deep work block like a meeting with your most important client.</li>
          <li><b>Batch availability:</b> set specific times for calls and messages instead of being always on.</li>
        </ul>
        <p>A kind, clear no is better than a resentful yes, both for you and for the other person.</p>`,
      takeaways: ['Every yes has a cost.', 'Pause before committing.', 'Treat focus blocks as real appointments.'],
      try: [{ label: 'Block protected focus time', action: 'block', title: 'Protected focus time', minutes: 120, cat: 'work' }],
    },
  ],
};
