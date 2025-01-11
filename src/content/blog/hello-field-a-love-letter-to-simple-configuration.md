---
title: "Hello, Field: A Love Letter to Simple Configuration"
publishDate: 2025-01-10
---
As I was working on my game engine, I was in need of a solid human-readable configuration format. It's one of those moments when you're thinking, "There has to be a better way," but to find the better way you go on a sidequest that takes 84 years. But hey, this is how Field was born.

## It Is Better Than JSON
Believe me, I've spent my fair share trying to work with all sorts of configuration files. YAML's need for identation is stupid. TOML has weird "headers" and nesting. JSON doesn't allow comments (I know, it's stupid). INI... well, INI is actuall pretty nice but it's quite limited and has no actual standard.

Most of these formats don't even support single line configurations and all of them are somewhat unnatural to write for us, programmers. What I really wanted was something that could be:

- Written on a single line
- Be comfortable to write, like data structures in a programming language
- Structured enough to handle complex data when needed
- Unambigous about its data types
- Easy to understand its structure

## Enter Field: The .fld format
So I created Field, a configuration format that's basically what would happen if JSON and C structs had a baby and raised it with good manners. Here's what it looks like:

```js
// Simple and clean
name = "Field";
version = 0.4;
is_awesome = true;

/* But can handle complex stuff, too */
settings = {
    theme = "dark";
    colors = ["#FF0000", "#00FF00", "#0000FF"];
    display = {
        brightness = 0.8;
        contrast = 1.0;
    };
};
```

Want it all on one line? Not a problem for the chad Field:

```js
name = "Field"; version = 0.4; /* In-line comment */ settings = { theme = "dark"; display = { brightness = 0.8; }; };
```
## Why Another Format?
Look, I know what you're thinking: "Oh great, another configuration format. Just what we needed!" And you're absolutely right to be skeptical. But hear me out:

1. **Single-Line Friendly**: Unlike YAML, Field doesn't mind if you squish everything onto one line. Perfect for command-line tools and quick configs.

2. **No Dependency Headaches**: The entire parser is a single header file. No package managers, no dependency hell, just drop it in and go.

3. **Bump Allocator Inside**: Because who doesn't love efficient memory management? (Okay, maybe that's just me being a nerd.)

## The Technical Bits (But Keep Reading!)
Under the hood, Field is powered by a simple parser that uses a bump allocator for memory management. It supports:
- Strings, numbers, booleans
- Arrays (of a single type, because we're civilized here)
- Nested objects
- Both line and block comments (because documentation matters!)

And the best part? It's all packed into a single header file that you can just drop into your project. No muss, no fuss. Speaking of the parser, here is a small demo on how the current version works in C:

```c
// Allocate memory for the parser
char memory[1024 * 8];
fld_parser parser;

// Parse the input
if (!fld_parse(&parser, input_string, memory, sizeof(memory))) {
    // Handle parsing error
    fld_error error = fld_get_last_error(&parser);
    printf("Error at line %d, column %d: %s\n", 
           error.line, 
           error.column, 
           fld_error_string(error.code));
}

// Get an integer value
int int_val;
if (fld_get_int(parser.root, "age", &int_val)) {
    printf("Age: %d\n", int_val);
}

// Get a string view
fld_string_view str_view;
if (fld_get_str_view(parser.root, "settings.theme", &str_view)) {
    printf("Theme: %.*s\n", str_view.length, str_view.start);
}
```

## What's Next?
Field is still young and growing. Version 0.4 just added some fancy features like iterators and better error handling, but there's always room for improvement. On the roadmap:
- More testing (because bugs are not features)
- Better memory estimation (because guessing is not a strategy)
- Getting rid of stdlib.h (because we can do better)
- Full API documentation (because future me will forget how this works)

## In Conclusion
Is Field going to replace JSON, YAML, or TOML? Probably not. But that was never the goal. It's a specialized tool for when you need something simple, fast, and lightweight. Plus, it was a blast to create!

If you're interested in trying it out, you can find Field on [GitHub](https://github.com/viktorfejes/field). Feel free to open issues, submit PRs, or just drop by to tell me why your favorite config format is better (it probably is, but Field is _mine_!).

Remember: The best configuration format is the one that solves your problem. For some of my problems, that turned out to be Field. Maybe it'll help with some of yours, too!

_P.S. If you're wondering why it's called Field - well, C structs have fields, and I'm terrible at naming things. At least I didn't call it Yet Another Configuration Format (YACF)!_