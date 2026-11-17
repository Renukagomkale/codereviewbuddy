import os
import json


def collect(items=[]):
    try:
        items.append(1)
    except:
        print("collect failed")
    return items


# TODO: handle errors properly
