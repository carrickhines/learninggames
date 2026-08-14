#!/usr/bin/env python3
"""Run .verify/save-test.html headlessly and report the result.

Usage:
    .verify/venv/bin/python .verify/run-save-test.py

Exit code 0 only if every assertion in the page passed.
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

try:
    d.get("file://" + os.path.join(HERE, "save-test.html"))
    for _ in range(50):                       # the import tests are async
        if d.execute_script("return !!window.RESULT"):
            break
        time.sleep(0.1)
    result = d.execute_script("return window.RESULT")
    for line in d.find_elements(By.CSS_SELECTOR, ".fail"):
        print(line.text)
    print(d.find_element(By.ID, "summary").text)
finally:
    d.quit()

sys.exit(1 if (not result or result["fail"]) else 0)
