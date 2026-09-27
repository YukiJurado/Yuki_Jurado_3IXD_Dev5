"""Build Yuki's Dev 5 single-PDF report from reviewed project evidence."""
from pathlib import Path
from xml.sax.saxutils import escape

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
    Image, KeepTogether, HRFlowable,
)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'submission' / 'Yuki_Jevelle_Jurado_3IXD_Dev5_PRD.PDF'
OUT.parent.mkdir(exist_ok=True)

NAVY = colors.HexColor('#203850')
BLUE = colors.HexColor('#316a9c')
PALE = colors.HexColor('#e9f2f9')
PAPER = colors.HexColor('#f8fbfe')
MUTED = colors.HexColor('#526b82')
LINE = colors.HexColor('#d6e4ef')
PAGE_W, PAGE_H = A4
WIDTH = PAGE_W - 92

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='CoverEyebrow', fontName='Helvetica-Bold', fontSize=10,
                          leading=14, textColor=BLUE, spaceAfter=14))
styles.add(ParagraphStyle(name='CoverTitle', fontName='Helvetica-Bold', fontSize=33,
                          leading=38, textColor=NAVY, spaceAfter=15))
styles.add(ParagraphStyle(name='CoverSub', fontName='Helvetica', fontSize=14,
                          leading=20, textColor=MUTED, spaceAfter=22))
styles.add(ParagraphStyle(name='Section', fontName='Helvetica-Bold', fontSize=19,
                          leading=24, textColor=NAVY, spaceAfter=12))
styles.add(ParagraphStyle(name='Subsection', fontName='Helvetica-Bold', fontSize=11.5,
                          leading=16, textColor=BLUE, spaceBefore=10, spaceAfter=6))
styles.add(ParagraphStyle(name='BodyX', fontName='Helvetica', fontSize=9.5,
                          leading=14.1, textColor=NAVY, spaceAfter=7))
styles.add(ParagraphStyle(name='SmallX', fontName='Helvetica', fontSize=8.3,
                          leading=11.4, textColor=NAVY, spaceAfter=5))
styles.add(ParagraphStyle(name='TinyX', fontName='Helvetica', fontSize=7.7,
                          leading=10.5, textColor=NAVY, spaceAfter=3))
styles.add(ParagraphStyle(name='CaptionX', fontName='Helvetica', fontSize=8.5,
                          leading=12, textColor=MUTED, spaceAfter=6))
styles.add(ParagraphStyle(name='MonoX', fontName='Courier', fontSize=8.1,
                          leading=12, textColor=NAVY, spaceAfter=0))
styles.add(ParagraphStyle(name='WhiteX', fontName='Helvetica-Bold', fontSize=9,
                          leading=12, textColor=colors.white))
styles.add(ParagraphStyle(name='CenterX', fontName='Helvetica', fontSize=9,
                          leading=13, textColor=NAVY, alignment=TA_CENTER))

def para(text, style='BodyX'):
    return Paragraph(text, styles[style])

def bullet(text, small=False):
    return para('• ' + text, 'SmallX' if small else 'BodyX')

def section(title, kicker=None):
    out = []
    if kicker:
        out.append(para(kicker.upper(), 'CoverEyebrow'))
    out.append(para(title, 'Section'))
    out.append(HRFlowable(width='100%', thickness=1, color=LINE, spaceAfter=12))
    return out

def card(text, bg=PALE, pad=11, width=WIDTH):
    t = Table([[para(text, 'BodyX')]], colWidths=[width])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), bg),
        ('BOX', (0, 0), (-1, -1), 0.6, LINE),
        ('LEFTPADDING', (0, 0), (-1, -1), pad),
        ('RIGHTPADDING', (0, 0), (-1, -1), pad),
        ('TOPPADDING', (0, 0), (-1, -1), pad),
        ('BOTTOMPADDING', (0, 0), (-1, -1), pad),
    ]))
    return t

def fit_image(path, max_w, max_h):
    with PILImage.open(path) as im:
        w, h = im.size
    scale = min(max_w / w, max_h / h)
    return Image(str(path), width=w * scale, height=h * scale)

def grid(rows, widths, header=True):
    processed = []
    for row in rows:
        processed.append([para(escape(str(cell)), 'SmallX') for cell in row])
    t = Table(processed, colWidths=widths, repeatRows=1 if header else 0, hAlign='LEFT')
    commands = [
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LINEBELOW', (0, 0), (-1, -1), 0.45, LINE),
    ]
    if header:
        commands += [('BACKGROUND', (0, 0), (-1, 0), PALE),
                     ('TEXTCOLOR', (0, 0), (-1, 0), BLUE)]
    t.setStyle(TableStyle(commands))
    return t

def on_page(canvas, doc):
    canvas.saveState()
    if doc.page > 1:
        canvas.setStrokeColor(LINE)
        canvas.line(46, PAGE_H - 37, PAGE_W - 46, PAGE_H - 37)
        canvas.setFont('Helvetica-Bold', 8)
        canvas.setFillColor(BLUE)
        canvas.drawString(46, PAGE_H - 30, 'FOCUSDESK  /  3IXD DEV 5')
    canvas.setStrokeColor(LINE)
    canvas.line(46, 39, PAGE_W - 46, 39)
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(46, 27, 'Yuki Jevelle Jurado  |  Assignment 1')
    canvas.drawRightString(PAGE_W - 46, 27, str(doc.page))
    canvas.restoreState()

story = []

# 1 — cover
story += [Spacer(1, 62), para('3IXD  /  DEVELOPMENT 5  /  ASSIGNMENT 1', 'CoverEyebrow'),
          para('FocusDesk', 'CoverTitle'),
          para('Research, product specification, design decisions and development evidence', 'CoverSub'),
          Spacer(1, 24), card('<b>One offline desktop app for planning tasks, focusing on them, and reviewing actual study time.</b> '
                              'The combined design brings the required to-do and Pomodoro/time-tracking tools into one application.'),
          Spacer(1, 30)]
story += [para('<b>Student</b>  Yuki Jevelle Jurado', 'BodyX'),
          para('<b>Class</b>  3IXD', 'BodyX'),
          para('<b>Date</b>  27 September 2026', 'BodyX'),
          para('<b>Repository</b>  <link href="https://github.com/YukiJurado/DevAssignment-1" color="#316a9c">github.com/YukiJurado/DevAssignment-1</link>', 'BodyX'),
          Spacer(1, 24), para('What this report includes', 'Subsection'),
          bullet('Research of three task apps and three timer/tracking apps; the resulting product choices.', True),
          bullet('A short PRD, design and technical decisions, and testable acceptance criteria.', True),
          bullet('Three original hand-drawn visual artifacts, each with the decision it helped make.', True),
          bullet('Actual FocusDesk Obsidian records, testing evidence, an AI-use note, and reflection.', True),
          Spacer(1, 18),
          para('The original research PDF and sketches are Yuki’s work. App screenshots from a disposable test vault are not presented as the student’s hand-drawn visuals.', 'CaptionX'),
          PageBreak()]

# 2 — research
story += section('Research: task applications', '01  /  research')
story += [para('The judgments below come from my supplied <i>App Research–Assignment 1.pdf</i>. Vendor pages were checked for product descriptions; these notes are not hands-on usability tests.', 'BodyX')]
story += [grid([
    ('Application', 'Useful observation and what I took from it', 'Left out of FocusDesk'),
    ('Todoist [1]', 'A friendly, structured task list suggested clear task cards and easy entry.', 'Collaboration and multi-user assignment.'),
    ('Microsoft To Do [2]', 'Simple lists and list groups suggested keeping organization understandable. Grouping was deferred in v1.', 'Outlook/Microsoft account integration.'),
    ('TickTick [3]', 'Its task-plus-Pomodoro pattern supported combining both functions in one app.', 'Habit tracking, calendar suite and collaboration.'),
], [88, 248, WIDTH - 336]), Spacer(1, 14)]
story += section('Research: timer and tracking applications')
story += [grid([
    ('Application', 'Useful observation and what I took from it', 'Left out of FocusDesk'),
    ('Pomofocus [4]', 'Custom focus/break timing and visual reports inspired the session flow and day/week/month bars.', 'Estimated finish time.'),
    ('Toggl Track [5]', 'One-click timing and reporting reinforced direct Start/Stop controls and actual-time summaries.', 'Background auto-tracking and agency reporting.'),
    ('Clockify [6]', 'Simple time entry and reporting showed the value of low-friction tracking.', 'GPS, kiosk, invoicing and team administration.'),
], [88, 248, WIDTH - 336]), Spacer(1, 12),
          card('<b>Essential features identified:</b> persistent task actions, controllable focus timing, actual-time history, and configurable breaks. '
               '<b>Ideas selected:</b> a timer attached to each task; a bar chart of actual completed focus time; a small task-colour palette. '
               'FocusDesk is intended for one student, so team features and cloud accounts are outside the first version.'),
          Spacer(1, 6),
          para('Correction to my original research: the earlier “unlimited free users” claim for Clockify is not used as a design fact; current pricing terms can change [7].', 'CaptionX'),
          PageBreak()]

# 3 — PRD
story += section('Short product requirements document', '02  /  product')
story += [para('<b>Purpose and user.</b> FocusDesk is for a student who needs help choosing work, staying focused, and seeing where study time went. It runs locally without an account, stores state on the computer, and writes task/focus events to a vault selected by the user.', 'BodyX'),
          para('The Grill discussion narrowed the scope to one student, task colours, deferred grouping, task-linked focus, an optional break after focus, and a bar chart of actual time rather than estimated progress.', 'BodyX'),
          para('Core features', 'Subsection'),
          bullet('Tasks: create, view, edit, delete, complete and reopen. Tasks survive restarting the app.', True),
          bullet('Focus: choose a task or enter a short activity description; start, pause, resume, stop/cancel, finish early or complete at zero. Paused time is excluded.', True),
          bullet('Breaks: adjustable focus and break lengths; remind the user on Timer shortly before focus ends and offer an optional break in the completion popup. Break time is separate from actual focus time.', True),
          bullet('History and Stats: completed sessions and day/week/month bars of actual time per task, with description-only sessions under “Other activities.”', True),
          para('Personal features', 'Subsection'),
          para('A task can have an optional description, colour, and suggested focus/break length. A task’s Focus action opens its own Timer page. A one-time +5-minute extension is available during focus. These are chosen features, not minimum requirements.', 'BodyX'),
          para('Non-goals', 'Subsection'),
          para('Accounts, cloud sync, collaboration, calendar planning, task groups, automatic background tracking, and billing are outside this version.', 'BodyX'),
          para('Main user flow', 'Subsection'),
          bullet('Select an existing Obsidian vault, then create a task on Tasks / Home.', True),
          bullet('Click Focus on a task; Timer opens with suggested lengths, which can be adjusted for that session. Alternatively start a description-only activity.', True),
          bullet('At zero, a linked open task becomes Completed. A completion popup offers an optional Start break or Later choice; Stats shows actual active time. Finishing early leaves the task open.', True),
          para('Acceptance checks', 'Subsection'),
          bullet('Tasks and completed sessions persist after restart; all required actions make one appropriate Markdown event in the selected vault.', True),
          bullet('Pause and closed-app time do not increase actual duration; cancelled sessions do not enter Stats; breaks do not enter focus totals.', True),
          bullet('The app works offline, the README supports a clean clone, and old vault events are never silently overwritten.', True),
          PageBreak()]

# 4 — decisions and verification
story += section('Design and technical decisions', '03  /  implementation')
story += [grid([
    ('Decision', 'Choice and reason'),
    ('One combined app', 'Tasks, Timer and Stats are separate pages in one Electron window and one repository. A task can open its focus session directly.'),
    ('Electron + plain JS', 'HTML, CSS and JavaScript were already familiar from class; Electron provides desktop file and folder access without a remote service.'),
    ('Local state', 'Task, session, setting and pending-event data live in an app-owned JSON file, saved on meaningful changes.'),
    ('Obsidian records', 'FocusDesk/tasks and FocusDesk/focus contain one uniquely named Markdown file per event. Records include date, time, timezone, type, status and identifiers. A failed write stays pending for retry. A generated Overview links records by task without changing them.'),
    ('Three-page layout', 'Tasks is home; task Focus opens Timer; Stats houses history and the bar chart. Blue surfaces and task-colour accents keep the interface calm and scannable.'),
    ('Usability', 'Stop warns about cancellation; Finish saves active time. Optional task suggestions provide a starting value without turning them into an estimate of actual time.'),
    ('Alternative not chosen', 'A Vue front end and two separate apps were considered. Plain JavaScript and one app reduce setup and integration work for this assignment.'),
], [122, WIDTH - 122]), Spacer(1, 15),
          para('Evidence from implementation', 'Subsection'),
          bullet('The app passes 32 automated tests, including a 30-minute focus plus 10-minute optional break, automatic task completion and linked-vault overview checks. A fresh copy passed npm ci using cached packages and all 32 tests; after Electron’s binary was installed, it launched with proxy access blocked.', True),
          bullet('An isolated Electron check used a disposable vault: task creation, task-to-Timer navigation, session overrides, completion, Stats, description-only focus, and a break worked.', True),
          bullet('The selected real vault contains app-generated FocusDesk event files with no pending writes. Obsidian recognizes the generated Overview and event backlinks; a final offline UI run after visual changes remains useful before submission.', True),
          para('These checks show what was exercised; they do not claim every possible timer or operating-system edge case has been manually tested.', 'CaptionX'),
          PageBreak()]

def visual_page(number, title, sketch_name, decision, change, app_note):
    page = section(title, f'04  /  visual artifact {number}')
    image = fit_image(ROOT / 'references' / sketch_name, 270, 438)
    right = [para('Original hand-drawn sketch', 'Subsection'),
             para('Yuki’s drawing in the project reference folder. It records the early idea rather than a finished app screenshot.', 'SmallX'),
             Spacer(1, 13), para('Decision it helped make', 'Subsection'), para(decision, 'BodyX'),
             Spacer(1, 10), para('How the final design changed', 'Subsection'), para(change, 'BodyX'),
             Spacer(1, 11), card(app_note, PAPER, 8, width=WIDTH - 282)]
    t = Table([[image, right]], colWidths=[282, WIDTH - 282], hAlign='LEFT')
    t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'),
                           ('LEFTPADDING', (0, 0), (-1, -1), 0),
                           ('RIGHTPADDING', (0, 0), (0, 0), 12),
                           ('RIGHTPADDING', (1, 0), (1, 0), 0)]))
    page += [t, Spacer(1, 9), para(f'Artifact {number}: {sketch_name} — original student sketch stored in references/.', 'CaptionX'), PageBreak()]
    return page

story += visual_page(1, 'Tasks / Home', 'Task-List-Sketch.png',
    'The large add action and individual task cards made the task list easy to scan. Each card needed a direct way to begin focusing.',
    'The sketch explored groups, dates and estimated hours. Those were dropped for v1. The implemented page keeps title, optional description, colour, suggested focus/break times and a Focus button.',
    '<b>Result:</b> Tasks became the home page; the blue desktop layout separates adding from reviewing existing tasks.')
story += visual_page(2, 'Timer and breaks', 'Timer-Sketch.png',
    'A large countdown should be the visual centre. The drawing also suggested obvious pause and break controls.',
    'The drawn 60:00 and ±10 are exploratory values. The built timer uses adjustable lengths, a once-only +5 extension, explicit Pause/Resume/Finish/Stop actions, and an optional break offer.',
    '<b>Result:</b> Clicking a task opens Timer with its suggested lengths; a short activity can also be entered without a task.')
story += visual_page(3, 'Stats and progress', 'Stats-Sketch.png',
    'The sketch raised the idea of a completion message and a bar chart that makes progress visible across days, weeks and months.',
    'Its percentage bars became bars of <b>actual completed focus time</b> per task. Stats is now a separate page with session history and Day/Week/Month filters. Breaks and cancelled sessions are excluded.',
    '<b>Result:</b> the chart answers where study time went rather than claiming a task is a certain percent finished.')

# 8 — vault evidence
story += section('Actual Obsidian records', '05  /  evidence')
story += [para('These examples are from the student’s selected desktop vault and were generated by the running FocusDesk app on 26 September 2026. Each event is a separate Markdown file; the examples below are excerpts, not manually invented events.', 'BodyX'),
          para('Task creation — FocusDesk/tasks/a34f7a7b-27d9-4d52-bb3b-bd5d41f1b8e0.md', 'Subsection'),
          card('<font name="Courier" size="8">Event type: task-created<br/>Status: open<br/>Date: 2026-09-26<br/>Time: 16:18:02<br/>Timezone: Europe/Brussels (UTC+02:00)<br/>Task ID: 4e9ac0e7-eb45-4a87-a7ae-899f02c38ce5<br/>Title: Test-Readchapter3</font>', PAPER),
          Spacer(1, 14),
          para('Focus completion — FocusDesk/focus/8276ffd5-fe27-461e-bf4e-bb693c7492b1.md', 'Subsection'),
          card('<font name="Courier" size="8">Event type: focus-completed<br/>Status: completed<br/>Date: 2026-09-26<br/>Time: 16:46:09<br/>Timezone: Europe/Brussels (UTC+02:00)<br/>Task title: Test-Read Book 3<br/>Planned minutes: 1<br/>Actual active duration: 60000 ms</font>', PAPER),
          Spacer(1, 15),
          para('How logging works', 'Subsection'),
          bullet('Task events go to FocusDesk/tasks; focus starts, completions and cancellations go to FocusDesk/focus.', True),
          bullet('Each file name is a unique event ID. The original files remain unchanged after later edits or status changes.', True),
          bullet('FocusDesk/Overview.md groups the existing task and focus records and links to each original event; the event files remain unchanged.', True),
          bullet('The app’s Stats chart is calculated from locally saved completed sessions; Obsidian receives event records and the linked overview, not an automatic chart note.', True),
          para('The separate submission sample, <i>Yuki_Jurado_3IXD_Dev5_Obsidiansample.md</i>, is an exact copy of a completed-focus record generated in the real vault.', 'CaptionX'),
          PageBreak()]

# 9 — AI, reflection, sources
story += section('AI use, reflection and sources', '06  /  process')
story += [para('AI note', 'Subsection'),
          para('I used Hermes with separate Coder and Researcher profiles to plan and build FocusDesk. I supplied the initial research, answered product questions, and drew the original sketches. AI helped refine the PRD, write and revise code, test storage/timer/UI behaviour, inspect the Electron app, document decisions, and assemble this report. Codex directly helped implement the local Stats bar chart and review the Obsidian connection. I checked real vault notes and a real countdown myself. The final work, source judgments and submission remain my responsibility. This note summarizes the work; it is not a full chat transcript.', 'BodyX'),
          para('Personal reflection', 'Subsection'),
          card('“The most challenging part was connecting Codex with Hermes and keeping the files together so Obsidian could use them. I learned that Electron can run a local desktop app for a project like this.”<br/><br/>— Yuki Jevelle Jurado', PALE),
          Spacer(1, 13),
          para('Before final submission', 'Subsection'),
          bullet('Run the updated app once without internet, then create a short real-vault session and check that its events appear in the Overview.', True),
          bullet('Submit the prepared app-generated .md sample separately using the brief’s required filename.', True),
          para('Sources', 'Subsection'),
          para('Student source: <i>App Research-Assignment 1.pdf</i> (Yuki Jevelle Jurado). Assignment source: <i>3IXD_Dev5_Assignment_1.pdf</i>. Product pages checked 27 September 2026; vendors may change features and pricing.', 'SmallX')]
sources = [
    ('[1] Todoist', 'https://www.todoist.com/features'),
    ('[2] Microsoft To Do', 'https://support.microsoft.com/en-us/todo/what-s-new-in-microsoft-to-do'),
    ('[3] TickTick', 'https://ticktick.com/'),
    ('[4] Pomofocus', 'https://pomofocus.io/'),
    ('[5] Toggl Track', 'https://toggl.com/'),
    ('[6] Clockify', 'https://clockify.me/'),
    ('[7] Clockify pricing', 'https://clockify.me/pricing'),
]
for label, url in sources:
    story.append(para(f'{escape(label)} — <link href="{url}" color="#316a9c">{escape(url)}</link>', 'TinyX'))

doc = SimpleDocTemplate(str(OUT), pagesize=A4, leftMargin=46, rightMargin=46,
                        topMargin=55, bottomMargin=55, title='FocusDesk — 3IXD Dev 5 Assignment 1',
                        author='Yuki Jevelle Jurado', subject='Research, PRD, visuals, evidence and reflection')
doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
print(OUT)
