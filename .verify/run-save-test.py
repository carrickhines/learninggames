#!/usr/bin/env python3
"""Run the browser-side unit test pages headlessly and report the result.

Usage:
    .verify/venv/bin/python .verify/run-save-test.py

Runs save-test.html and log-test.html — the assertions over shared/save.js and
shared/log.js. Exit code 0 only if every one passed.
"""
import os, sys, time
from selenium import webdriver
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.common.by import By

HERE = os.path.dirname(os.path.abspath(__file__))

opts = Options()
opts.add_argument("--headless")
service = Service(executable_path=os.path.join(HERE, "geckodriver"), log_output=os.devnull)
d = webdriver.Firefox(options=opts, service=service)

PAGES = ["save-test.html", "log-test.html"]
failed = 0

try:
    for page in PAGES:
        d.get("file://" + os.path.join(HERE, page))
        for _ in range(60):                   # the import tests are async
            if d.execute_script("return !!window.RESULT"):
                break
            time.sleep(0.1)
        result = d.execute_script("return window.RESULT")
        for line in d.find_elements(By.CSS_SELECTOR, ".fail"):
            print(line.text)
        print("%-18s %s" % (page, d.find_element(By.ID, "summary").text))
        if not result or result["fail"]:
            failed += 1
finally:
    d.quit()

sys.exit(1 if failed else 0)
