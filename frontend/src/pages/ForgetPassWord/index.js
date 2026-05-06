import React, { useState } from "react";
import qs from "query-string";
import { Eye, EyeOff, MailCheck, ShieldAlert } from "lucide-react";
import * as Yup from "yup";
import { useHistory } from "react-router-dom";
import { Link as RouterLink } from "react-router-dom";
import { Formik, Form, Field } from "formik";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import moment from "moment";
import { toast } from "react-toastify";
import toastError from "../../errors/toastError";
import "react-toastify/dist/ReactToastify.css";

const logo = `${process.env.REACT_APP_BACKEND_URL}/public/logotipos/login.png`;
const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/;

const ForgetPassword = () => {
  const history = useHistory();
  let companyId = null;
  const [showAdditionalFields, setShowAdditionalFields] = useState(false);
  const [showResetPasswordButton, setShowResetPasswordButton] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  const toggleAdditionalFields = () => {
    setShowAdditionalFields(!showAdditionalFields);
    if (showAdditionalFields) {
      setShowResetPasswordButton(false);
    } else {
      setShowResetPasswordButton(true);
    }
  };

  const params = qs.parse(window.location.search);
  if (params.companyId !== undefined) {
    companyId = params.companyId;
  }

  const initialState = { email: "" };

  const [user] = useState(initialState);
  const dueDate = moment().add(3, "day").format();

  const handleSendEmail = async values => {
    const email = values.email;
    try {
      const response = await api.post(
        `${process.env.REACT_APP_BACKEND_URL}/forgetpassword/${email}`
      );
      console.log("API Response:", response.data);

      if (response.data.status === 404) {
        toast.error("Email não encontrado");
      } else {
        toast.success(i18n.t("Email enviado com sucesso!"));
      }
    } catch (err) {
      console.log("API Error:", err);
      toastError(err);
    }
  };

  const handleResetPassword = async values => {
    const email = values.email;
    const token = values.token;
    const newPassword = values.newPassword;
    const confirmPassword = values.confirmPassword;

    if (newPassword === confirmPassword) {
      try {
        await api.post(
          `${process.env.REACT_APP_BACKEND_URL}/resetpasswords/${email}/${token}/${newPassword}`
        );
        setError("");
        toast.success(i18n.t("Senha redefinida com sucesso."));
        history.push("/login");
      } catch (err) {
        console.log(err);
      }
    }
  };

  const isResetPasswordButtonClicked = showResetPasswordButton;
  const UserSchema = Yup.object().shape({
    email: Yup.string().email("Invalid email").required("Required"),
    newPassword: isResetPasswordButtonClicked
      ? Yup.string()
          .required("Campo obrigatório")
          .matches(
            passwordRegex,
            "Sua senha precisa ter no mínimo 8 caracteres, sendo uma letra maiúscula, uma minúscula e um número."
          )
      : Yup.string(),
    confirmPassword: Yup.string().when("newPassword", {
      is: newPassword => isResetPasswordButtonClicked && newPassword,
      then: Yup.string()
        .oneOf([Yup.ref("newPassword"), null], "As senhas não correspondem")
        .required("Campo obrigatório"),
      otherwise: Yup.string(),
    }),
  });

  return (
    <div className="min-h-screen bg-[#eef2f7]">
      <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
        <div className="relative hidden items-center justify-center bg-gradient-to-br from-[#0c3547] via-[#155e75] to-[#0891b2] p-10 lg:flex">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(34,211,238,0.2),transparent_50%)]" />
          <div className="relative w-full max-w-2xl rounded-2xl border border-white/25 bg-white/10 p-8 backdrop-blur-md">
            <img
              className="mx-auto w-full max-w-lg rounded-xl object-contain"
              src={logo}
              alt="Whats"
            />
          </div>
        </div>

        <div className="flex items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-md">
            <div className="mb-4 rounded-2xl border border-brand-200 bg-brand-50 p-3 text-center lg:hidden">
              <img
                className="mx-auto h-20 w-auto object-contain"
                src={logo}
                alt="Whats"
              />
            </div>

            <div className="form-card">
              <div className="mb-5">
                <h1 className="page-title">{i18n.t("Redefinir senha")}</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Informe seu email para receber o código e redefinir a senha.
                </p>
              </div>

              <Formik
                initialValues={{
                  email: "",
                  token: "",
                  newPassword: "",
                  confirmPassword: "",
                }}
                enableReinitialize={true}
                validationSchema={UserSchema}
                onSubmit={(values, actions) => {
                  setTimeout(() => {
                    if (showResetPasswordButton) {
                      handleResetPassword(values);
                    } else {
                      handleSendEmail(values);
                    }
                    actions.setSubmitting(false);
                    toggleAdditionalFields();
                  }, 400);
                }}
              >
                {({ touched, errors, isSubmitting }) => (
                  <Form className="space-y-4">
                    <div>
                      <label className="form-label" htmlFor="email">
                        {i18n.t("signup.form.email")}
                      </label>
                      <Field
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        className="form-input"
                        required
                      />
                      {touched.email && errors.email && (
                        <p className="mt-1 text-xs text-red-600">{errors.email}</p>
                      )}
                    </div>

                    {showAdditionalFields && (
                      <>
                        <div>
                          <label className="form-label" htmlFor="token">
                            Código de Verificação
                          </label>
                          <Field
                            id="token"
                            name="token"
                            autoComplete="off"
                            className="form-input"
                            required
                          />
                          {touched.token && errors.token && (
                            <p className="mt-1 text-xs text-red-600">{errors.token}</p>
                          )}
                        </div>

                        <div>
                          <label className="form-label" htmlFor="newPassword">
                            Nova senha
                          </label>
                          <div className="relative">
                            <Field
                              id="newPassword"
                              name="newPassword"
                              type={showPassword ? "text" : "password"}
                              autoComplete="off"
                              className="form-input pr-10"
                              required
                            />
                            <button
                              type="button"
                              onClick={togglePasswordVisibility}
                              className="absolute inset-y-0 right-3 inline-flex items-center text-gray-500 hover:text-brand-700"
                              aria-label="Alternar visibilidade da senha"
                            >
                              {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                            </button>
                          </div>
                          {touched.newPassword && errors.newPassword && (
                            <p className="mt-1 text-xs text-red-600">{errors.newPassword}</p>
                          )}
                        </div>

                        <div>
                          <label className="form-label" htmlFor="confirmPassword">
                            Confirme a senha
                          </label>
                          <div className="relative">
                            <Field
                              id="confirmPassword"
                              name="confirmPassword"
                              type={showConfirmPassword ? "text" : "password"}
                              autoComplete="off"
                              className="form-input pr-10"
                              required
                            />
                            <button
                              type="button"
                              onClick={toggleConfirmPasswordVisibility}
                              className="absolute inset-y-0 right-3 inline-flex items-center text-gray-500 hover:text-brand-700"
                              aria-label="Alternar visibilidade da confirmação de senha"
                            >
                              {showConfirmPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                            </button>
                          </div>
                          {touched.confirmPassword && errors.confirmPassword && (
                            <p className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p>
                          )}
                        </div>
                      </>
                    )}

                    {showResetPasswordButton ? (
                      <button
                        type="submit"
                        className="btn-primary inline-flex w-full items-center justify-center gap-2"
                        disabled={isSubmitting}
                      >
                        <ShieldAlert size={16} />
                        Redefinir Senha
                      </button>
                    ) : (
                      <button
                        type="submit"
                        className="btn-primary inline-flex w-full items-center justify-center gap-2"
                        disabled={isSubmitting}
                      >
                        <MailCheck size={16} />
                        Enviar Email
                      </button>
                    )}

                    <div className="text-right">
                      <RouterLink
                        className="text-sm font-semibold text-brand-700 hover:text-brand-800"
                        to="/signup"
                      >
                        {i18n.t("Não tem uma conta? Cadastre-se!")}
                      </RouterLink>
                    </div>

                    {error && <p className="alert-error">{error}</p>}
                  </Form>
                )}
              </Formik>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgetPassword;
