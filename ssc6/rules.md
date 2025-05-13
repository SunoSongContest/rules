---
layout: page
title: SSC6 Rules
permalink: /ssc6/
emoji: 6️⃣
order: 1
short_description: 6th Edition of Suno Song Contest
classname: page
tag: contest-edition
---

# Suno Song Contest 6

We’re excited to have you here to contribute your creativity, connect with friends all around the world, and appreciate inspiring music!

**The rules below should explain everything you need to know about SSC6!**

<h2 class="rules-h">Guides</h2>
<div class="pages">
    {% for page in pages %}
        {% if page.path contains 'ssc6/' page.title and page.emoji and page.tag and page.tag == 'guide' %}
        <a href="{{ page.url | prepend: site.baseurl }}">
            <span class="emoji">{{ page.emoji }}</span>
            <b>{{ page.title }}</b>
            <i>{{ page.short_description }}</i>
        </a>
        {% endif %}
    {% endfor %}
</div>
