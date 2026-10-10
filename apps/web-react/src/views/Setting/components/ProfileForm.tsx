import { Form, Input, Switch, TimePicker } from "antd";
import type { FormInstance } from "antd";
import dayjs from "dayjs";
import type { UserUpdate } from "@en/common/user";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ProfileFormProps {
  form: FormInstance<UserUpdate>;
}

/**
 * 个人信息表单 —— 对应 Vue 版 el-form + el-form-item + rules。
 *
 * 这里选择用 Ant Design Form 而非手写，原因是表单校验是真正复杂的部分：
 * 错误时机、字段联动、异步校验、可访问性 —— 手写等于重造轮子。
 * 该页通过 React.lazy 懒加载，AntD 不会进入首屏包。
 *
 * 校验规则与 Vue 版逐条对应：
 *   name            必填
 *   email           选填；但开启定时任务时必填；填了则校验格式
 *   timingTaskTime  选填；但开启定时任务时必选
 */
export default function ProfileForm({ form }: ProfileFormProps) {
  const isTimingTask = Form.useWatch("isTimingTask", form);

  return (
    <Form
      form={form}
      layout="horizontal"
      labelCol={{ style: { width: 140 } }}
      requiredMark={false}
      className="mt-1"
    >
      <Form.Item
        label="用户名："
        name="name"
        rules={[{ required: true, message: "请输入用户名" }]}
      >
        <Input placeholder="请输入用户名" allowClear />
      </Form.Item>

      <Form.Item
        label="邮箱："
        name="email"
        dependencies={["isTimingTask"]}
        rules={[
          {
            validator: async (_, value: string) => {
              if (!value) {
                if (isTimingTask) {
                  throw new Error("开启定时任务后需要填写邮箱以接收打卡提醒");
                }
                return;
              }
              if (!EMAIL_RE.test(value)) {
                throw new Error("请输入正确的邮箱格式");
              }
            },
          },
        ]}
      >
        <Input placeholder="请输入邮箱" allowClear />
      </Form.Item>

      <Form.Item label="定时任务：" name="isTimingTask" valuePropName="checked">
        <Switch />
      </Form.Item>

      <Form.Item
        label="定时任务时间："
        name="timingTaskTime"
        dependencies={["isTimingTask"]}
        rules={[
          {
            validator: async (_, value: unknown) => {
              if (!value && isTimingTask) {
                throw new Error("开启定时任务后需要选择任务时间");
              }
            },
          },
        ]}
        extra={
          <div className="mt-3 text-xs text-slate-500">
            tips:开启定时任务需要先填写邮箱，用于接收每日打卡提醒
          </div>
        }
      >
        <TimePicker
          format="HH:mm:ss"
          placeholder="请选择定时任务时间"
          disabled={!isTimingTask}
          className="w-50"
          needConfirm={false}
        />
      </Form.Item>

      <Form.Item label="地址：" name="address">
        <Input placeholder="请输入地址" allowClear />
      </Form.Item>

      <Form.Item label="签名：" name="bio">
        <Input.TextArea
          placeholder="写点什么介绍一下自己"
          rows={4}
          maxLength={120}
          showCount
        />
      </Form.Item>
    </Form>
  );
}

/** "HH:mm:ss" <-> dayjs 转换（AntD TimePicker 使用 dayjs 对象） */
export const toDayjs = (value?: string) =>
  value ? dayjs(value, "HH:mm:ss") : null;

export const fromDayjs = (value: unknown): string =>
  value && dayjs.isDayjs(value) ? value.format("HH:mm:ss") : "";
