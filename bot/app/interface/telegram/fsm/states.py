from aiogram.fsm.state import State, StatesGroup


class TaskStates(StatesGroup):
    idle = State()
    awaiting_task_text = State()
    awaiting_merge_decision = State()
