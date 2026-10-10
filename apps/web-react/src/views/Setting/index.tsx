import { useEffect, useRef, useState } from "react";
import { App as AntApp, Button, Card, ConfigProvider, Form, Tag } from "antd";
import type { ChangeEvent } from "react";
import type { UserUpdate } from "@en/common/user";
import { updateUser, uploadAvatar } from "@/apis/user";
import { useAvatar } from "@/hooks/useAvatar";
import { useLogin } from "@/hooks/useLogin";
import { useUserStore } from "@/stores/user";
import ProfileForm, { fromDayjs, toDayjs } from "./components/ProfileForm";

const EMPTY: UserUpdate = {
  name: "",
  email: "",
  address: "",
  bio: "",
  avatar: "",
  isTimingTask: false,
  timingTaskTime: "",
};

/** 用 EP 的视觉参数收敛 AntD 默认风格，缩小两版差异 */
function SettingRoot() {
  return (
    <ConfigProvider
      theme={{ token: { colorPrimary: "#409eff", borderRadius: 4 } }}
    >
      <AntApp>
        <SettingInner />
      </AntApp>
    </ConfigProvider>
  );
}

function SettingInner() {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { avatar } = useAvatar();
  const { logout } = useLogin();
  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);

  useEffect(() => {
    if (!user) return;
    form.setFieldsValue({
      name: user.name,
      email: user.email ?? "",
      address: user.address ?? "",
      bio: user.bio ?? "",
      avatar: user.avatar ?? "",
      isTimingTask: user.isTimingTask,
      timingTaskTime: toDayjs(user.timingTaskTime),
    });
  }, [form, user]);

  const onReset = () => {
    form.setFieldsValue({
      ...EMPTY,
      timingTaskTime: toDayjs(EMPTY.timingTaskTime),
    });
  };

  const onSave = async () => {
    let values: UserUpdate;
    try {
      values = await form.validateFields();
    } catch {
      return; // 校验失败：AntD 已在对应字段下展示错误
    }
    const res = await updateUser({
      ...values,
      timingTaskTime: fromDayjs(values.timingTaskTime),
    });
    if (res.success && res.data) {
      if (user) setUser({ ...user, ...res.data });
      message.success("更新成功");
    } else {
      message.error(res.message ?? "更新失败");
    }
  };

  const onFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 允许重复选择同一文件
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    const res = await uploadAvatar(formData);
    if (res.success && res.data) {
      form.setFieldValue("avatar", res.data.databaseUrl);
      setPreviewUrl(res.data.previewUrl);
    } else {
      message.error(res.message ?? "上传失败");
    }
  };

  return (
    <div className="mx-auto w-300 px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-extrabold text-slate-900">设置</div>
          <div className="mt-1 text-sm text-slate-500">
            在这里修改你的个人信息与头像
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={onReset}>重置</Button>
          <Button type="primary" onClick={() => void onSave()}>
            保存
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="col-span-1">
          <Card title="头像">
            <div className="flex items-center gap-4">
              <img
                className="h-20 w-20 rounded-full border-2 border-gray-200 object-cover"
                src={previewUrl || avatar}
                loading="lazy"
                referrerPolicy="no-referrer"
                alt="头像"
              />
              <div className="flex flex-col gap-2">
                <Button type="primary" onClick={() => fileRef.current?.click()}>
                  选择头像
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void onFileChange(e)}
                />
                <div className="text-xs text-slate-500">
                  支持 png/jpg/webp，建议小于 2MB
                </div>
              </div>
            </div>
          </Card>

          <Card title="账号" className="mt-4">
            <div className="text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span>登录状态</span>
                {user ? <Tag color="success">已登录</Tag> : <Tag>未登录</Tag>}
              </div>
            </div>
          </Card>
        </div>

        <div className="col-span-2">
          <Card title="个人信息">
            <ProfileForm form={form} />
          </Card>

          <Card title="危险操作" className="mt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-900">退出登录</div>
                <div className="text-sm text-slate-500">清除本地登录状态</div>
              </div>
              <Button danger onClick={logout}>
                退出
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default SettingRoot;
