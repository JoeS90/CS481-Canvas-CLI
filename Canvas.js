process.loadEnvFile();

const DEBUG_LEVEL = 0;
const TOKEN = process.env.CANVAS_API_TOKEN;
const BASE_URL = "https://boisestatecanvas.instructure.com/api";

async function getToDo(days, ignorePastDue)
{
    const todoURL = BASE_URL + "/v1/users/self/todo?per_page=100";
    const now = new Date();
    const lastDay = new Date();
    lastDay.setDate(now.getDate() + days);
    lastDay.setHours(23,59,59,999);

    try
    {
        const response = await fetch(todoURL, 
        { 
            headers: {"Authorization": `Bearer ${TOKEN}`} 
        });
        if(DEBUG_LEVEL >= 1){ console.log("Fetch full list response status: " + response.status); }
        
        if(!response.ok)
        {
            console.error("Error: " + response.status);
            return;
        }

        const events = await response.json();
        if(DEBUG_LEVEL >= 1){ console.log("Number of elements returned: " + events.length); }
        if(DEBUG_LEVEL >= 2){ console.log(events);}

        var eventList = [];
        var unknownDueDate = [];
        var courseCodes = [];

        for(var i = 0; i < events.length; i++)
        {
            const dueDate = events[i].assignment.due_at ? new Date(events[i].assignment.due_at) : null;

            if( (dueDate !== null) && ((dueDate < now && ignorePastDue) || (dueDate > lastDay)) ){ continue; }

            var nextAssignment = 
            { 
                "name": events[i].assignment.name,
                "course_code": events[i].assignment.course_id,
                "due": dueDate,
                "isQuiz": events[i].assignment.is_quiz_assignment,
                "course_name": null
            };

            var found = false;
            for(var j = 0; j < courseCodes.length; j++)
            {
                if(courseCodes[j].code === nextAssignment.course_code)
                {
                    found = true;
                    nextAssignment.course_name = courseCodes[j].name;
                    break;
                }
            }

            if(!found)
            {
                var newCode = 
                { 
                    "code": nextAssignment.course_code,
                    "name": await getCourseName(nextAssignment.course_code)
                }

                courseCodes.push(newCode);

                nextAssignment.course_name = newCode.name;
            }

            if(nextAssignment.due == null)
            {
                unknownDueDate.push(nextAssignment);
            }
            else
            {
                eventList.push(nextAssignment);
            }
        }

        if( eventList.length === 0 && unknownDueDate.length === 0)
        {
            console.log("Nothing to do for the next " + days + " days!");
            return;
        }
 
        var output = "Your " + days + "-day To-Do List\n"

        if( eventList.length > 0)
        {
            eventList.sort((a,b) => a.due - b.due);

            var currentDate = eventList[0].due.toLocaleDateString();
            output += currentDate + ":\n";

            for(var i = 0; i < eventList.length; i++)
            {
                if(eventList[i].due.toLocaleDateString() !== currentDate)
                {
                    currentDate = eventList[i].due.toLocaleDateString()
                    output += currentDate + ":\n";
                }

                output += "\t";
                output += eventList[i].isQuiz ? "QUIZ: " : "";
                output += eventList[i].name + " (" + eventList[i].course_name + ")";
                output += eventList[i].due < now ? " !!OVERDUE!!" : "";
                output += "\n";
            }
        }

        if(unknownDueDate.length > 1)
        {
            output += "Unknown Due Date:\n"
            
            for(var i = 0; i < unknownDueDate.length; i++)
            {
                output += "\t";
                output += unknownDueDate[i].isQuiz ? "QUIZ: " : "";
                output += unknownDueDate[i].name + " (" + unknownDueDate[i].course_name + ")";
                output += "\n";
            }
        }

        console.log(output);
    }
    catch(e)
    {
        console.error(e.message);
    }
}

async function getCourseName(courseCode)
{
    const courseURL = BASE_URL + "/v1/courses/" + courseCode;

    try
    {
        const response = await fetch(courseURL,
        { 
            headers: {"Authorization": `Bearer ${TOKEN}`} 
        });

        if(!response.ok)
        {
            console.error("Course query unsuccessful");
            return "unknown course";
        }
        const data = await response.json();

        return data.nickname || data.name;
    }
    catch(e)
    {
        console.error(e.message);
        return "error fetching name";
    }
}

async function main()
{
    const DEFAULT_OUTLOOK = 7;

    if(process.argv.length < 3)
    {
        console.log(    "USAGE: \n" +
                        "\tnode Canvas.js todo <num_days (default: " + DEFAULT_OUTLOOK + ")> <ignorePastDue (default: true)>\n"
        );
        return;
    }

    if(process.argv[2] == "todo")
    {
        const input = parseInt(process.argv[3]);
        const days = isNaN(input) ? DEFAULT_OUTLOOK : input;
        const ignorePastDue = process.argv[4] !== "false";

        await getToDo(days, ignorePastDue);
    }
}

main();