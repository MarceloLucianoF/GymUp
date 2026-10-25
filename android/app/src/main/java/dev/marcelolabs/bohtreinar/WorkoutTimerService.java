package dev.marcelolabs.bohtreinar;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

/**
 * Treino em andamento: notificação fixa com o exercício, a série e o cronômetro do descanso correndo (contagem regressiva do
 * próprio sistema). O serviço em primeiro plano mantém o app vivo durante o treino, então o alerta do fim do descanso
 * (som e vibração) sai na hora certa mesmo com a tela bloqueada, sem depender do servidor. Os botões mudam conforme o momento.
 */
public class WorkoutTimerService extends Service {
    static final String ACTION_UPDATE = "dev.marcelolabs.bohtreinar.timer.UPDATE";
    static final String ACTION_STOP = "dev.marcelolabs.bohtreinar.timer.STOP";
    static final String ACTION_BUTTON = "dev.marcelolabs.bohtreinar.timer.BUTTON";
    static final String CH_ONGOING = "treino_andamento";
    static final String CH_ALERT = "treino_descanso";
    static final int ID_ONGOING = 4101;
    static final int ID_ALERT = 4102;

    /** Recebe os toques nos botões (o plugin repassa ao app). */
    interface Listener { void onAction(String action); }
    static Listener listener;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private String title = "Treino em andamento";
    private String body = "";
    private String alertTitle = "Descanso acabou";
    private long endsAt = 0;
    private final Runnable restOver = this::onRestOver;

    @Override public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        createChannels();
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_STOP.equals(action)) { stopAll(); return START_NOT_STICKY; }
        if (ACTION_BUTTON.equals(action)) {
            String button = intent.getStringExtra("button");
            if ("rest".equals(button)) setRest(0);                                  // pula o descanso aqui mesmo
            else if ("add30".equals(button) && endsAt > 0) setRest(endsAt + 30000);
            if (listener != null && button != null) listener.onAction(button);    // o app atualiza a tela e o estado do treino
            show();
            return START_NOT_STICKY;
        }
        if (intent != null) {
            title = orDefault(intent.getStringExtra("title"), title);
            body = orDefault(intent.getStringExtra("body"), "");
            alertTitle = orDefault(intent.getStringExtra("alertTitle"), "Descanso acabou");
            setRest(intent.getLongExtra("endsAt", 0));
        }
        show();
        return START_NOT_STICKY;
    }

    private static String orDefault(String v, String d) { return v == null || v.isEmpty() ? d : v; }

    private void setRest(long when) {
        handler.removeCallbacks(restOver);
        endsAt = when > System.currentTimeMillis() ? when : 0;
        if (endsAt > 0) handler.postDelayed(restOver, endsAt - System.currentTimeMillis());
    }

    private void onRestOver() {
        endsAt = 0;
        NotificationManager nm = getSystemService(NotificationManager.class);
        Notification alert = new NotificationCompat.Builder(this, CH_ALERT)
            .setSmallIcon(R.drawable.ic_stat_bohtreinar)
            .setContentTitle(alertTitle)
            .setContentText("Bora para a próxima série!")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(true)
            .setTimeoutAfter(60000)
            .setVibrate(new long[] { 0, 300, 150, 300 })
            .setContentIntent(openApp())
            .build();
        nm.notify(ID_ALERT, alert);
        if (listener != null) listener.onAction("restOver");
        show();
    }

    private PendingIntent openApp() {
        Intent open = new Intent(this, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private PendingIntent button(String name, int code) {
        Intent i = new Intent(this, WorkoutTimerService.class).setAction(ACTION_BUTTON).putExtra("button", name);
        return PendingIntent.getService(this, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private void show() {
        boolean resting = endsAt > System.currentTimeMillis();
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CH_ONGOING)
            .setSmallIcon(R.drawable.ic_stat_bohtreinar)
            .setContentTitle(title)
            .setContentText(resting ? "Descansando · " + firstLine(body) : firstLine(body))
            .setStyle(new NotificationCompat.BigTextStyle().bigText((resting ? "Descansando\n" : "") + body))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_WORKOUT)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(openApp());
        if (resting) {
            b.setUsesChronometer(true).setChronometerCountDown(true).setWhen(endsAt).setShowWhen(true);
            b.addAction(0, "Pular descanso", button("rest", 1));
            b.addAction(0, "+30 s", button("add30", 2));
        } else {
            b.setShowWhen(false);
            b.addAction(0, "Concluir série", button("done", 3));
            b.addAction(0, "Desfazer série", button("undo", 4));
        }
        Notification n = b.build();
        // Android 16: pede destaque como "atualização ao vivo" (chip na barra de status; na Samsung pode ir para a Now Bar).
        if (Build.VERSION.SDK_INT >= 36) n.extras.putBoolean("android.requestPromotedOngoing", true);
        int type = Build.VERSION.SDK_INT >= 34 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE : 0;
        ServiceCompat.startForeground(this, ID_ONGOING, n, type);
    }

    private static String firstLine(String s) { int i = s.indexOf('\n'); return i < 0 ? s : s.substring(0, i); }

    private void stopAll() {
        handler.removeCallbacks(restOver);
        endsAt = 0;
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    @Override public void onDestroy() { handler.removeCallbacks(restOver); super.onDestroy(); }

    private void createChannels() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        NotificationChannel ongoing = new NotificationChannel(CH_ONGOING, "Treino em andamento", NotificationManager.IMPORTANCE_LOW);
        ongoing.setDescription("Exercício, série e cronômetro do descanso durante o treino");
        ongoing.setShowBadge(false);
        nm.createNotificationChannel(ongoing);
        NotificationChannel alert = new NotificationChannel(CH_ALERT, "Fim do descanso", NotificationManager.IMPORTANCE_HIGH);
        alert.setDescription("Toca e vibra quando o descanso acaba");
        alert.enableVibration(true);
        alert.setVibrationPattern(new long[] { 0, 300, 150, 300 });
        nm.createNotificationChannel(alert);
    }

    static void send(Context ctx, Intent i) {
        if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i); else ctx.startService(i);
    }
}
